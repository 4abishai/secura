import React, { useState } from 'react';

const ECDHExample = () => {
  const [keys, setKeys] = useState({
    alice: { publicKey: '', privateKey: null },
    bob: { publicKey: '', privateKey: null }
  });
  const [sharedSecrets, setSharedSecrets] = useState({
    alice: '',
    bob: ''
  });
  const [keysGenerated, setKeysGenerated] = useState(false);
  const [exchangeCompleted, setExchangeCompleted] = useState(false);

  // Generate ECDH key pair
  const generateKeyPair = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      true,
      ["deriveKey", "deriveBits"]
    );
    return keyPair;
  };

  // Export public key as base64
  const exportPublicKey = async (key) => {
    const exported = await window.crypto.subtle.exportKey("raw", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  };

  // Import public key from base64
  const importPublicKey = async (publicKeyBase64) => {
    const binaryString = atob(publicKeyBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const publicKey = await window.crypto.subtle.importKey(
      "raw",
      bytes,
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      true,
      []
    );
    
    return publicKey;
  };

  // Derive shared secret
  const deriveSharedSecret = async (privateKey, publicKey) => {
    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: "ECDH",
        public: publicKey
      },
      privateKey,
      256
    );
    
    // Convert to hex string
    return Array.from(new Uint8Array(sharedSecret))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // Generate keys for both parties
  const handleGenerateKeys = async () => {
    try {
      // Generate Alice's keys
      const aliceKeyPair = await generateKeyPair();
      const alicePublicKeyBase64 = await exportPublicKey(aliceKeyPair.publicKey);
      
      // Generate Bob's keys
      const bobKeyPair = await generateKeyPair();
      const bobPublicKeyBase64 = await exportPublicKey(bobKeyPair.publicKey);
      
      setKeys({
        alice: {
          publicKey: alicePublicKeyBase64,
          privateKey: aliceKeyPair.privateKey
        },
        bob: {
          publicKey: bobPublicKeyBase64,
          privateKey: bobKeyPair.privateKey
        }
      });
      
      setKeysGenerated(true);
      setExchangeCompleted(false);
      setSharedSecrets({ alice: '', bob: '' });
    } catch (error) {
      console.error('Error generating keys:', error);
    }
  };

  // Perform key exchange
  const handleKeyExchange = async () => {
    try {
      // Alice computes shared secret using Bob's public key
      const bobPublicKey = await importPublicKey(keys.bob.publicKey);
      const aliceSharedSecret = await deriveSharedSecret(keys.alice.privateKey, bobPublicKey);
      
      // Bob computes shared secret using Alice's public key
      const alicePublicKey = await importPublicKey(keys.alice.publicKey);
      const bobSharedSecret = await deriveSharedSecret(keys.bob.privateKey, alicePublicKey);
      
      setSharedSecrets({
        alice: aliceSharedSecret,
        bob: bobSharedSecret
      });
      
      setExchangeCompleted(true);
    } catch (error) {
      console.error('Error during key exchange:', error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>ECDH Key Exchange Demo</h1>
      
      <button 
        onClick={handleGenerateKeys}
        style={{
          backgroundColor: '#4CAF50',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        Generate Keys
      </button>
      
      {keysGenerated && (
        <button 
          onClick={handleKeyExchange}
          style={{
            backgroundColor: '#2196F3',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginLeft: '10px',
            marginBottom: '20px'
          }}
        >
          Perform Key Exchange
        </button>
      )}
      
      {keysGenerated && (
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1, border: '1px solid #ccc', padding: '15px', borderRadius: '4px' }}>
            <h3>Alice's Keys</h3>
            <p><strong>Public Key:</strong></p>
            <textarea 
              value={keys.alice.publicKey} 
              readOnly 
              style={{ width: '100%', height: '100px', fontSize: '12px' }}
            />
          </div>
          
          <div style={{ flex: 1, border: '1px solid #ccc', padding: '15px', borderRadius: '4px' }}>
            <h3>Bob's Keys</h3>
            <p><strong>Public Key:</strong></p>
            <textarea 
              value={keys.bob.publicKey} 
              readOnly 
              style={{ width: '100%', height: '100px', fontSize: '12px' }}
            />
          </div>
        </div>
      )}
      
      {exchangeCompleted && (
        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
          <h3>Shared Secrets</h3>
          <div style={{ marginBottom: '10px' }}>
            <p><strong>Alice's Shared Secret:</strong></p>
            <textarea 
              value={sharedSecrets.alice} 
              readOnly 
              style={{ width: '100%', height: '60px', fontSize: '12px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <p><strong>Bob's Shared Secret:</strong></p>
            <textarea 
              value={sharedSecrets.bob} 
              readOnly 
              style={{ width: '100%', height: '60px', fontSize: '12px' }}
            />
          </div>
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 
            sharedSecrets.alice === sharedSecrets.bob ? '#d4edda' : '#f8d7da', 
            borderRadius: '4px' 
          }}>
            <strong>Keys Match: </strong>
            <span style={{ 
              color: sharedSecrets.alice === sharedSecrets.bob ? '#155724' : '#721c24',
              fontWeight: 'bold'
            }}>
              {sharedSecrets.alice === sharedSecrets.bob ? 'YES' : 'NO'}
            </span>
          </div>
        </div>
      )}
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
        <h4>How it works:</h4>
        <ol>
          <li>Click "Generate Keys" to create ECDH key pairs for Alice and Bob</li>
          <li>Click "Perform Key Exchange" to compute shared secrets</li>
          <li>Both parties should arrive at the same shared secret</li>
        </ol>
        <p><strong>Note:</strong> This demo runs entirely in your browser using the Web Crypto API</p>
      </div>
    </div>
  );
};

export default ECDHExample;