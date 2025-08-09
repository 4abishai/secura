// utils/MessageUtils.js
import { 
  importPublicKey, 
  deriveAESKey, 
  encryptMessage as cryptoEncryptMessage, 
  decryptMessage as cryptoDecryptMessage, 
  exportKeyBytes 
} from './crypto';

export const messageUtils = {
  encryptMessage: async (privateKey, recipientPublicKey, message, senderUsername, recipientUsername) => {
    try {
      const recipientPubKey = await importPublicKey(recipientPublicKey);
      const aesKey = await deriveAESKey(privateKey, recipientPubKey);

      const keyHex = await exportKeyBytes(aesKey);
      console.log(`[${senderUsername}] Shared key with ${recipientUsername}: ${keyHex}`);

      const encrypted = await cryptoEncryptMessage(aesKey, message);
      return encrypted;
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw error;
    }
  },

  decryptMessage: async (privateKey, otherUserPublicKey, encryptedContent, currentUsername, otherUsername) => {
    try {
      const otherUserPubKey = await importPublicKey(otherUserPublicKey);
      const aesKey = await deriveAESKey(privateKey, otherUserPubKey);

      const keyHex = await exportKeyBytes(aesKey);
      console.log(`[${currentUsername}] Shared key with ${otherUsername}: ${keyHex}`);

      const decryptedText = await cryptoDecryptMessage(aesKey, encryptedContent);
      return decryptedText;
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw error;
    }
  },

  formatTimestamp: (timestamp) => {
    return new Date(timestamp).toLocaleString();
  },

  sortMessagesByTimestamp: (messages) => {
    return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  },

  filterMessagesByUser: (messages, user1, user2) => {
    return messages.filter(msg => 
      (msg.sender === user1 && msg.recipient === user2) || 
      (msg.sender === user2 && msg.recipient === user1)
    );
  },

  messageExists: (messages, messageId) => {
    return messages.some(msg => msg.id === messageId);
  }
};