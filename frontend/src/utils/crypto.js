// export const exportKeyBytes = async (key) => {
//   const raw = await window.crypto.subtle.exportKey('raw', key);
//   return Array.from(new Uint8Array(raw)).map(b => b.toString(16).padStart(2, '0')).join('');
// };

// export const generateOrLoadKeyPair = async () => {
//   // Check if we already have keys stored
//   const storedPrivateKey = JSON.parse(localStorage.getItem('privateKey') || 'null');
//   const storedPublicKey = localStorage.getItem('publicKey');

//   if (storedPrivateKey && storedPublicKey) {
//     try {
//       const privKey = await window.crypto.subtle.importKey(
//         'jwk',
//         storedPrivateKey,
//         { name: 'ECDH', namedCurve: 'P-256' },
//         true,
//         ['deriveKey', 'deriveBits']
//       );
//       return { privateKey: privKey, publicKey: storedPublicKey };
//     } catch (error) {
//       console.error('Failed to import stored keys, generating new ones:', error);
//       // Clear invalid stored keys
//       localStorage.removeItem('privateKey');
//       localStorage.removeItem('publicKey');
//     }
//   }

//   // Generate new keypair
//   const keyPair = await window.crypto.subtle.generateKey(
//     {
//       name: 'ECDH',
//       namedCurve: 'P-256'
//     },
//     true,
//     ['deriveKey', 'deriveBits']
//   );

//   const exportedPriv = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
//   const exportedPub = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
//   const pubKeyBase64 = arrayBufferToBase64(exportedPub);

//   localStorage.setItem('privateKey', JSON.stringify(exportedPriv));
//   localStorage.setItem('publicKey', pubKeyBase64);

//   return { privateKey: keyPair.privateKey, publicKey: pubKeyBase64 };
// };

// export const importPublicKey = async (base64) => {
//   const binary = atob(base64);
//   const bytes = new Uint8Array([...binary].map(c => c.charCodeAt(0)));
//   return await window.crypto.subtle.importKey(
//     'raw',
//     bytes,
//     { name: 'ECDH', namedCurve: 'P-256' },
//     true,
//     []
//   );
// };

// export const deriveAESKey = async (privKey, pubKey) => {
//   return await window.crypto.subtle.deriveKey(
//     {
//       name: 'ECDH',
//       public: pubKey
//     },
//     privKey,
//     { name: 'AES-GCM', length: 256 },
//     true,
//     ['encrypt', 'decrypt']
//   );
// };

// export function arrayBufferToBase64(buffer) {
//   const bytes = new Uint8Array(buffer);
//   let binary = '';
//   for (let i = 0; i < bytes.byteLength; i++) {
//     binary += String.fromCharCode(bytes[i]);
//   }
//   return btoa(binary);
// }

// export function base64ToArrayBuffer(base64) {
//   const binary = atob(base64);
//   const len = binary.length;
//   const bytes = new Uint8Array(len);
//   for (let i = 0; i < len; i++) {
//     bytes[i] = binary.charCodeAt(i);
//   }
//   return bytes.buffer;
// }

// export const encryptMessage = async (aesKey, text) => {
//   const iv = window.crypto.getRandomValues(new Uint8Array(12));
//   const encoded = new TextEncoder().encode(text);
//   const ciphertext = await window.crypto.subtle.encrypt(
//     { name: 'AES-GCM', iv },
//     aesKey,
//     encoded
//   );

//   const combined = new Uint8Array(iv.length + ciphertext.byteLength);
//   combined.set(iv);
//   combined.set(new Uint8Array(ciphertext), iv.length);

//   return arrayBufferToBase64(combined);
// };

// export const decryptMessage = async (aesKey, base64) => {
//   try {
//     const combined = new Uint8Array(base64ToArrayBuffer(base64));
//     const iv = combined.slice(0, 12);
//     const ciphertext = combined.slice(12);

//     const decrypted = await window.crypto.subtle.decrypt(
//       { name: 'AES-GCM', iv },
//       aesKey,
//       ciphertext
//     );
//     const msg = new TextDecoder().decode(decrypted)
//     console.log('Decrypted message:', msg);
//     return new TextDecoder().decode(decrypted);
//   } catch (err) {
//     console.error('Decryption failed:', err.message, base64);
//     return '[Decryption Failed]';
//   }
// };

// utils/crypto.js
export const exportKeyBytes = async (key) => {
  const raw = await window.crypto.subtle.exportKey('raw', key);
  return Array.from(new Uint8Array(raw)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const generateOrLoadKeyPair = async () => {
  // Check if we already have keys stored
  const storedPrivateKey = JSON.parse(localStorage.getItem('privateKey') || 'null');
  const storedPublicKey = localStorage.getItem('publicKey');

  if (storedPrivateKey && storedPublicKey) {
    try {
      console.log('Loading stored keys...');
      const privKey = await window.crypto.subtle.importKey(
        'jwk',
        storedPrivateKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );
      console.log('Successfully loaded stored keys');
      return { privateKey: privKey, publicKey: storedPublicKey };
    } catch (error) {
      console.error('Failed to import stored keys, generating new ones:', error);
      // Clear invalid stored keys
      localStorage.removeItem('privateKey');
      localStorage.removeItem('publicKey');
    }
  }

  // Generate new keypair
  console.log('Generating new keypair...');
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveKey', 'deriveBits']
  );

  const exportedPriv = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const exportedPub = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
  const pubKeyBase64 = arrayBufferToBase64(exportedPub);

  localStorage.setItem('privateKey', JSON.stringify(exportedPriv));
  localStorage.setItem('publicKey', pubKeyBase64);

  console.log('New keypair generated and stored');
  console.log('Public key length:', pubKeyBase64.length);

  return { privateKey: keyPair.privateKey, publicKey: pubKeyBase64 };
};

export const importPublicKey = async (base64) => {
  try {
    console.log('Importing public key, base64 length:', base64.length);
    const binary = atob(base64);
    const bytes = new Uint8Array([...binary].map(c => c.charCodeAt(0)));
    console.log('Binary length:', binary.length, 'Bytes length:', bytes.length);
    
    const key = await window.crypto.subtle.importKey(
      'raw',
      bytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );
    console.log('Successfully imported public key');
    return key;
  } catch (error) {
    console.error('Failed to import public key:', error.message, 'Base64:', base64.substring(0, 50));
    throw error;
  }
};

export const deriveAESKey = async (privKey, pubKey) => {
  try {
    console.log('Deriving AES key...');
    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'ECDH',
        public: pubKey
      },
      privKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    console.log('AES key derived successfully');
    return aesKey;
  } catch (error) {
    console.error('Failed to derive AES key:', error.message);
    throw error;
  }
};

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const base64ToArrayBuffer = (base64) => {
  try {
    console.log('Converting base64 to ArrayBuffer, length:', base64.length);
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    console.log('Converted to', len, 'bytes');
    return bytes.buffer;
  } catch (error) {
    console.error('Base64 decode error:', error.message, 'Input:', base64.substring(0, 50));
    throw new Error(`Invalid base64 string: ${error.message}`);
  }
};

export const encryptMessage = async (aesKey, text) => {
  try {
    console.log('Encrypting message:', text);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    
    console.log('IV:', Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''));
    console.log('Plaintext bytes:', encoded.length);
    
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoded
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    const result = arrayBufferToBase64(combined);
    console.log('Encrypted message base64 length:', result.length);
    console.log('Encrypted message:', result);
    return result;
  } catch (error) {
    console.error('Encryption failed:', error.message);
    throw error;
  }
};

export const decryptMessage = async (aesKey, base64) => {
  try {
    console.log('=== DECRYPTION START ===');
    console.log('Decryption attempt - base64 length:', base64.length);
    console.log('Base64 content:', base64);
    
    const combined = new Uint8Array(base64ToArrayBuffer(base64));
    console.log('Combined array length:', combined.length);
    
    if (combined.length < 12) {
      throw new Error('Invalid encrypted data: too short for IV');
    }
    
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    
    console.log('IV length:', iv.length);
    console.log('Ciphertext length:', ciphertext.length);
    console.log('IV hex:', Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''));
    console.log('First 16 bytes of ciphertext:', Array.from(ciphertext.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(''));

    // Log the AES key for debugging (be careful in production)
    const keyBytes = await window.crypto.subtle.exportKey('raw', aesKey);
    const keyHex = Array.from(new Uint8Array(keyBytes)).map(b => b.toString(16).padStart(2, '0')).join('');
    console.log('AES key being used:', keyHex);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    );
    
    const msg = new TextDecoder().decode(decrypted);
    console.log('Successfully decrypted message:', msg);
    console.log('=== DECRYPTION SUCCESS ===');
    return msg;
  } catch (err) {
    console.error('=== DECRYPTION FAILED ===');
    console.error('Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      base64Input: base64,
      base64Length: base64.length
    });
    
    // Additional debugging for common issues
    if (err.name === 'OperationError') {
      console.error('This is likely a key mismatch or data corruption issue');
    } else if (err.name === 'InvalidAccessError') {
      console.error('This is likely an issue with the AES key or algorithm parameters');
    }
    
    return '[Decryption Failed]';
  }
};