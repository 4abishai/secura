// src/services/indexedDB.js
const DB_NAME = 'SecuraDB';
const DB_VERSION = 1;
const STORE_NAME = 'userCredentials';

class IndexedDBService {
  constructor() {
    this.db = null;
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(new Error('IndexedDB open failed'));
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'username' });
          store.createIndex('username', 'username', { unique: true });
          store.createIndex('publicKey', 'publicKey', { unique: false });
        }
      };
    });
  }

  async storeUserCredentials(username, publicKey, privateKey) {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        username,
        publicKey,
        privateKey,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(new Error('Store failed'));
    });
  }

  async getUserCredentials(username) {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(username);
      req.onsuccess = () => {
        const data = req.result;
        if (data) this.updateLastAccessed(username).catch(console.error);
        resolve(data || null);
      };
      req.onerror = () => reject(new Error('Get failed'));
    });
  }

  async updateLastAccessed(username) {
    if (!this.db) await this.initDB();
    const tx = this.db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(username);
    getReq.onsuccess = () => {
      const rec = getReq.result;
      if (!rec) return;
      rec.lastAccessed = new Date().toISOString();
      store.put(rec);
    };
  }

  async getAllUsers() {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error('getAll failed'));
    });
  }

  async deleteUserCredentials(username) {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(username);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Delete failed'));
    });
  }

  async clearAllData() {
    if (!this.db) await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Clear failed'));
    });
  }

  async userExists(username) {
    const data = await this.getUserCredentials(username);
    return !!data;
  }

  closeDB() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default new IndexedDBService();
