// src/mock/mockServer.js
class MockServer {
  constructor() {
    this.keyStore = {};
    this.userStores = {};
    this.messages = {};
  }

  registerUser(id, bundle, store) {
    this.keyStore[id] = bundle;
    this.userStores[id] = store;
    console.log(`User ${id} registered successfully`);
  }

  getUserBundle(id) {
    if (!this.keyStore[id]) {
      throw new Error(`User ${id} not found`);
    }
    return this.keyStore[id];
  }

  getUserStore(id) {
    if (!this.userStores[id]) {
      throw new Error(`Store for user ${id} not found`);
    }
    return this.userStores[id];
  }

  // Message handling
storeMessage(senderId, recipientId, encryptedMessage) {
  const chatId = this.getChatId(senderId, recipientId);
  const message = {
    id: Date.now().toString(),
    senderId,
    recipientId,
    encryptedMessage,
    timestamp: new Date().toISOString()
  };

  // Get current messages from localStorage
  const stored = JSON.parse(localStorage.getItem(`chat_${chatId}`)) || [];
  stored.push(message);

  localStorage.setItem(`chat_${chatId}`, JSON.stringify(stored));
  return message;
}

getMessages(user1Id, user2Id) {
  const chatId = this.getChatId(user1Id, user2Id);
  return JSON.parse(localStorage.getItem(`chat_${chatId}`)) || [];
}

  // storeMessage(senderId, recipientId, encryptedMessage) {
  //   const chatId = this.getChatId(senderId, recipientId);
  //   if (!this.messages[chatId]) {
  //     this.messages[chatId] = [];
  //   }
    
  //   const message = {
  //     id: Date.now().toString(),
  //     senderId,
  //     recipientId,
  //     encryptedMessage,
  //     timestamp: new Date().toISOString()
  //   };
    
  //   this.messages[chatId].push(message);
  //   return message;
  // }

  // getMessages(user1Id, user2Id) {
  //   const chatId = this.getChatId(user1Id, user2Id);
  //   return this.messages[chatId] || [];
  // }

  getChatId(user1, user2) {
    return [user1, user2].sort().join('_');
  }

  // Get all registered users (for demo purposes)
  getAllUsers() {
    return Object.keys(this.keyStore);
  }

  // Check if user exists
  userExists(id) {
    return this.keyStore.hasOwnProperty(id);
  }

  // Clear all data (for testing)
  clear() {
    this.keyStore = {};
    this.userStores = {};
    this.messages = {};
  }
}

// Create singleton instance
export const mockServer = new MockServer();

// Legacy exports for backwards compatibility
export const registerUser = (id, bundle, store) => mockServer.registerUser(id, bundle, store);
export const getUserBundle = (id) => mockServer.getUserBundle(id);
export const getUserStore = (id) => mockServer.getUserStore(id);