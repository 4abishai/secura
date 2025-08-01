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
      const privKey = await window.crypto.subtle.importKey(
        'jwk',
        storedPrivateKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey', 'deriveBits']
      );
      return { privateKey: privKey, publicKey: storedPublicKey };
    } catch (error) {
      console.error('Failed to import stored keys, generating new ones:', error);
      // Clear invalid stored keys
      localStorage.removeItem('privateKey');
      localStorage.removeItem('publicKey');
    }
  }

  // Generate new keypair
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

  return { privateKey: keyPair.privateKey, publicKey: pubKeyBase64 };
};

export const importPublicKey = async (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array([...binary].map(c => c.charCodeAt(0)));
  return await window.crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
};

export const deriveAESKey = async (privKey, pubKey) => {
  return await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: pubKey
    },
    privKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export const encryptMessage = async (aesKey, text) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );

  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return arrayBufferToBase64(combined);
};

export const decryptMessage = async (aesKey, base64) => {
  try {
    const combined = new Uint8Array(base64ToArrayBuffer(base64));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    );
    const msg = new TextDecoder().decode(decrypted)
    console.log('Decrypted message:', msg);
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('Decryption failed:', err.message, base64);
    return '[Decryption Failed]';
  }
};