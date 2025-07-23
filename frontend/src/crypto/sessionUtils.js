// src/crypto/sessionUtils.js
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';
import { base64ToArrayBuffer } from './cryptoUtils';

export async function buildSessionWithRecipient(recipientId, bundle, signalStore) {
  try {
    console.log(`Building session with recipient: ${recipientId}`);
    
    const address = new libsignal.SignalProtocolAddress(recipientId, 1);
    const sessionBuilder = new libsignal.SessionBuilder(signalStore, address);

    // Prepare the prekey bundle for session building
    const preKeyBundle = {
      registrationId: bundle.registrationId,
      identityKey: base64ToArrayBuffer(bundle.identityKey),
      signedPreKey: {
        keyId: bundle.signedPreKey.keyId,
        publicKey: base64ToArrayBuffer(bundle.signedPreKey.publicKey),
        signature: base64ToArrayBuffer(bundle.signedPreKey.signature),
      },
      oneTimePreKey: bundle.oneTimePreKeys.length > 0 ? {
        keyId: bundle.oneTimePreKeys[0].keyId,
        publicKey: base64ToArrayBuffer(bundle.oneTimePreKeys[0].publicKey),
      } : null,
    };

    await sessionBuilder.processPreKey(preKeyBundle);
    console.log(`Session established with ${recipientId}`);
    
    return address;
  } catch (error) {
    console.error(`Failed to build session with ${recipientId}:`, error);
    throw error;
  }
}

export async function encryptMessage(store, recipientAddress, plaintext) {
  try {
    console.log(`Encrypting message for ${recipientAddress.getName()}`);
    
    const cipher = new libsignal.SessionCipher(store, recipientAddress);
    const encoder = new TextEncoder();
    const buffer = encoder.encode(plaintext);
    
    const ciphertext = await cipher.encrypt(buffer.buffer);
    console.log('Message encrypted successfully');
    
    return ciphertext;
  } catch (error) {
    console.error('Failed to encrypt message:', error);
    throw error;
  }
}

export async function decryptMessage(store, senderAddress, ciphertext) {
  try {
    console.log(`Decrypting message from ${senderAddress.getName()}`);
    
    const cipher = new libsignal.SessionCipher(store, senderAddress);
    
    let decryptedBuffer;
    if (ciphertext.type === 3) {
      // PreKey message
      decryptedBuffer = await cipher.decryptPreKeyWhisperMessage(ciphertext.body, 'binary');
    } else {
      // Regular message
      decryptedBuffer = await cipher.decryptWhisperMessage(ciphertext.body, 'binary');
    }
    
    console.log('Message decrypted successfully');
    return decryptedBuffer;
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    throw error;
  }
}

export function createSignalProtocolStore() {
  const store = {};
  
  const signalStore = {
    // Basic storage operations
    get: (key) => store[key],
    put: (key, value) => { store[key] = value; },
    remove: (key) => { delete store[key]; },

    // Identity key operations
    getIdentityKeyPair: () => store['identityKey'],
    loadIdentityKey: () => store['identityKey'],
    
    // Identity validation
    isTrustedIdentity: (identifier, identityKey, direction) => {
      console.log(`Checking trust for identity: ${identifier}`);
      // In a real app, you'd implement proper identity validation
      // For demo purposes, we trust all identities
      return Promise.resolve(true);
    },

    // Save remote identity
    saveIdentity: (identifier, identityKey) => {
      console.log(`Saving identity for: ${identifier}`);
      const existing = store[`identityKey_${identifier}`];
      const keyBase64 = arrayBufferToBase64(identityKey);
      
      if (existing) {
        const existingBase64 = arrayBufferToBase64(existing);
        const isSame = existingBase64 === keyBase64;
        store[`identityKey_${identifier}`] = identityKey;
        return Promise.resolve(!isSame);
      } else {
        store[`identityKey_${identifier}`] = identityKey;
        return Promise.resolve(false);
      }
    },

    // Load remote identity
    loadIdentity: (identifier) => {
      return Promise.resolve(store[`identityKey_${identifier}`]);
    },

    // PreKey operations
    storePreKey: (keyId, keyPair) => {
      console.log(`Storing prekey: ${keyId}`);
      store[`preKey_${keyId}`] = keyPair;
      return Promise.resolve();
    },

    loadPreKey: (keyId) => {
      console.log(`Loading prekey: ${keyId}`);
      const preKey = store[`preKey_${keyId}`];
      if (!preKey) {
        throw new Error(`PreKey ${keyId} not found`);
      }
      return Promise.resolve(preKey);
    },

    removePreKey: (keyId) => {
      console.log(`Removing prekey: ${keyId}`);
      delete store[`preKey_${keyId}`];
      return Promise.resolve();
    },

    // Signed PreKey operations
    storeSignedPreKey: (keyId, keyPair) => {
      console.log(`Storing signed prekey: ${keyId}`);
      store[`signedPreKey_${keyId}`] = keyPair;
      return Promise.resolve();
    },

    loadSignedPreKey: (keyId) => {
      console.log(`Loading signed prekey: ${keyId}`);
      const signedPreKey = store[`signedPreKey_${keyId}`];
      if (!signedPreKey) {
        throw new Error(`Signed PreKey ${keyId} not found`);
      }
      return Promise.resolve(signedPreKey);
    },

    removeSignedPreKey: (keyId) => {
      console.log(`Removing signed prekey: ${keyId}`);
      delete store[`signedPreKey_${keyId}`];
      return Promise.resolve();
    },

    // Session operations
    storeSession: (identifier, record) => {
      console.log(`Storing session: ${identifier}`);
      store[`session_${identifier}`] = record;
      return Promise.resolve();
    },

    loadSession: (identifier) => {
      console.log(`Loading session: ${identifier}`);
      return Promise.resolve(store[`session_${identifier}`]);
    },

    containsSession: (identifier) => {
      const exists = `session_${identifier}` in store;
      console.log(`Session exists for ${identifier}: ${exists}`);
      return Promise.resolve(exists);
    },

    removeSession: (identifier) => {
      console.log(`Removing session: ${identifier}`);
      delete store[`session_${identifier}`];
      return Promise.resolve();
    },

    // Registration ID
    getLocalRegistrationId: () => {
      return Promise.resolve(store['registrationId']);
    },
  };

  return signalStore;
}

// Helper function to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  try {
    if (!buffer) {
      return null;
    }
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  } catch (error) {
    console.error('Failed to convert ArrayBuffer to Base64:', error);
    return null;
  }
}