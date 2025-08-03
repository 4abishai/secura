// src/utils/crypto.js
import indexedDBService from '../services/IndexedDB.js';

export function arrayBufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
export function base64ToArrayBuffer(base64) {
  const bin = atob(base64), len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function generateOrLoadKeyPair(username = null) {
  // Try IndexedDB
  if (username) {
    const rec = await indexedDBService.getUserCredentials(username);
    if (rec) {
      const priv = await crypto.subtle.importKey(
        'jwk', rec.privateKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveKey','deriveBits']
      );
      return { privateKey: priv, publicKey: rec.publicKey };
    }
  }
  // Fallback / generation
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey','deriveBits']
  );
  const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  const rawPub = await crypto.subtle.exportKey('raw', kp.publicKey);
  const pubB64 = arrayBufferToBase64(rawPub);

  if (username) {
    await indexedDBService.storeUserCredentials(username, pubB64, privJwk);
  }
  return { privateKey: kp.privateKey, publicKey: pubB64 };
}

export async function importPublicKey(b64) {
  return crypto.subtle.importKey(
    'raw',
    new Uint8Array(base64ToArrayBuffer(b64)),
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function deriveAESKey(priv, pub) {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: pub },
    priv,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt','decrypt']
  );
}

export async function encryptMessage(aesKey, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(text);
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, aesKey, data);
  return arrayBufferToBase64(new Uint8Array([...iv, ...new Uint8Array(ct)]));
}

export async function decryptMessage(aesKey, b64) {
  const combined = new Uint8Array(base64ToArrayBuffer(b64));
  const iv = combined.slice(0,12), ct = combined.slice(12);
  const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, aesKey, ct);
  return new TextDecoder().decode(pt);
}
