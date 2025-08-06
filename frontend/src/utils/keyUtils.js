import { generateOrLoadKeyPair as cryptoGenerateOrLoadKeyPair } from './crypto';

export const generateOrLoadKeyPair = async () => {
  try {
    return await cryptoGenerateOrLoadKeyPair();
  } catch (error) {
    console.error('Error generating or loading key pair:', error);
    throw error;
  }
};

export const keyUtils = {
  generateOrLoadKeyPair,
  
  validateKeyPair: (privateKey, publicKey) => {
    return privateKey && publicKey;
  },

  clearStoredKeys: () => {
    try {
      // Clear any stored key data from localStorage if applicable
      // This would depend on your crypto implementation
      console.log('Clearing stored keys');
    } catch (error) {
      console.error('Error clearing stored keys:', error);
    }
  },

  exportPublicKey: (publicKey) => {
    // Return the public key in the format needed for sharing
    return publicKey;
  },

  formatKeyForDisplay: (key) => {
    if (!key) return 'No key';
    if (typeof key === 'string') {
      return key.length > 20 ? `${key.substring(0, 20)}...` : key;
    }
    return 'Binary key';
  }
};