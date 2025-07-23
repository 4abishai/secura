// src/crypto/cryptoUtils.js
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';

export async function generateIdentity(store) {
  try {
    const identityKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
    const registrationId = await libsignal.KeyHelper.generateRegistrationId();
    
    store.put('identityKey', identityKeyPair);
    store.put('registrationId', registrationId);
    
    console.log('Identity generated:', { 
      identityKey: identityKeyPair ? 'Generated' : 'Failed',
      registrationId 
    });
    
    return { identityKeyPair, registrationId };
  } catch (error) {
    console.error('Failed to generate identity:', error);
    throw error;
  }
}

export async function generatePreKeys(store) {
  try {
    const identityKeyPair = store.get('identityKey');
    if (!identityKeyPair) {
      throw new Error('Identity key pair not found. Generate identity first.');
    }

    // Generate signed pre-key
    const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(identityKeyPair, 1);
    
    // Generate multiple one-time pre-keys
    const oneTimePreKeys = await Promise.all(
      Array.from({ length: 100 }, (_, i) => 
        libsignal.KeyHelper.generatePreKey(i + 2)
      )
    );

    // Store the complete signed prekey (with private key) in the store
    store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);
    
    // Store one-time prekeys in the store
    oneTimePreKeys.forEach(preKey => {
      store.storePreKey(preKey.keyId, preKey.keyPair);
    });

    // Keep references for bundle export
    store.put('signedPreKey', signedPreKey);
    store.put('oneTimePreKeys', oneTimePreKeys);

    console.log(`Generated ${oneTimePreKeys.length} one-time prekeys and 1 signed prekey`);
    
    return { signedPreKey, oneTimePreKeys };
  } catch (error) {
    console.error('Failed to generate pre-keys:', error);
    throw error;
  }
}

export async function exportBundle(store) {
  try {
    const identityKeyPair = store.get('identityKey');
    const registrationId = store.get('registrationId');
    const signedPreKey = store.get('signedPreKey');
    const oneTimePreKeys = store.get('oneTimePreKeys');

    if (!identityKeyPair || !registrationId || !signedPreKey || !oneTimePreKeys) {
      throw new Error('Missing required keys for bundle export');
    }

    const bundle = {
      identityKey: arrayBufferToBase64(identityKeyPair.pubKey),
      registrationId,
      signedPreKey: {
        keyId: signedPreKey.keyId,
        publicKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
        signature: arrayBufferToBase64(signedPreKey.signature),
      },
      oneTimePreKeys: oneTimePreKeys.slice(0, 10).map(pk => ({
        keyId: pk.keyId,
        publicKey: arrayBufferToBase64(pk.keyPair.pubKey),
      })),
    };

    console.log('Bundle exported successfully');
    return bundle;
  } catch (error) {
    console.error('Failed to export bundle:', error);
    throw error;
  }
}

// Helper function to convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  try {
    if (!buffer) {
      throw new Error('Buffer is null or undefined');
    }
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
  } catch (error) {
    console.error('Failed to convert ArrayBuffer to Base64:', error);
    throw error;
  }
}

// Helper function to convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64) {
  try {
    if (!base64) {
      throw new Error('Base64 string is null or undefined');
    }
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
  } catch (error) {
    console.error('Failed to convert Base64 to ArrayBuffer:', error);
    throw error;
  }
}

// Utility function to generate a random user ID
export function generateUserId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Validate phone number format
export function validatePhoneNumber(phone) {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

// Normalize phone number (remove spaces, ensure it starts with +)
export function normalizePhoneNumber(phone) {
  let normalized = phone.replace(/\s/g, '');
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  return normalized;
}