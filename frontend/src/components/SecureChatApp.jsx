import React, { useEffect, useState } from 'react';

const apiBase = 'http://localhost:3000';

const SecureChatApp = () => {
  const [username, setUsername] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [privateKey, setPrivateKey] = useState(null);
  const [publicKeyBase64, setPublicKeyBase64] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [polling, setPolling] = useState(null);

  const exportKeyBytes = async (key) => {
    const raw = await window.crypto.subtle.exportKey('raw', key);
    return Array.from(new Uint8Array(raw)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const generateOrLoadKeyPair = async () => {
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
        setPrivateKey(privKey);
        setPublicKeyBase64(storedPublicKey);
        return storedPublicKey;
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

    setPrivateKey(keyPair.privateKey);
    setPublicKeyBase64(pubKeyBase64);
    return pubKeyBase64;
  };

  const importPublicKey = async (base64) => {
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

  const deriveAESKey = async (privKey, pubKey) => {
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

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  const encryptMessage = async (aesKey, text) => {
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

  const decryptMessage = async (aesKey, base64) => {
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

  const registerUser = async () => {
    if (!inputUsername.trim()) {
      alert('Please enter a username');
      return;
    }
    
    try {
      const pubKey = await generateOrLoadKeyPair();
      const res = await fetch(`${apiBase}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: inputUsername, publicKey: pubKey })
      });

      if (res.ok) {
        localStorage.setItem('username', inputUsername);
        setUsername(inputUsername);
        await fetchUsers();
        startPolling();
      } else {
        const errorText = await res.text();
        alert(`Registration failed: ${errorText}`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed. Please try again.');
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${apiBase}/users`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.filter(u => u.username !== username));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedUser) return;

    try {
      const recipient = users.find(u => u.username === selectedUser);
      if (!recipient) {
        alert('Recipient not found');
        return;
      }

      const recipientPubKey = await importPublicKey(recipient.publicKey);
      const aesKey = await deriveAESKey(privateKey, recipientPubKey);

      const keyHex = await exportKeyBytes(aesKey);
      console.log(`[${username}] Shared key with ${selectedUser}: ${keyHex}`);

      const encrypted = await encryptMessage(aesKey, message);
      
      const res = await fetch(`${apiBase}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: username,
          recipient: selectedUser,
          content: encrypted,
          timestamp: new Date().toISOString()
        })
      });

      if (!res.ok) throw new Error('Failed to send message');
      setMessage('');
      
      // Immediately fetch messages to show the sent message
      await fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  };

  const fetchMessages = async () => {
    if (!username || !privateKey) return;

    try {
      const res = await fetch(`${apiBase}/messages?user=${username}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      
      const data = await res.json();
      console.log('Fetched messages:', data);

      // Get all users to ensure we have all public keys
      const usersRes = await fetch(`${apiBase}/users`);
      const allUsers = await usersRes.json();
      const userMap = {};
      allUsers.forEach(user => {
        userMap[user.username] = user;
      });

      const decrypted = await Promise.all(
        data.map(async (msg) => {
          try {
            // Determine who the "other" user is (the one we need to derive key with)
            const otherUsername = msg.sender === username ? msg.recipient : msg.sender;
            const otherUser = userMap[otherUsername];
            
            if (!otherUser) {
              console.warn(`Could not find user: ${otherUsername}`);
              return { ...msg, decrypted: `[Unknown user: ${otherUsername}]` };
            }

            const otherUserPubKey = await importPublicKey(otherUser.publicKey);
            const aesKey = await deriveAESKey(privateKey, otherUserPubKey);

            const keyHex = await exportKeyBytes(aesKey);
            console.log(`[${username}] Shared key with ${otherUsername}: ${keyHex}`);

            const decryptedText = await decryptMessage(aesKey, msg.content);
            return { ...msg, decrypted: decryptedText };
          } catch (error) {
            console.error('Failed to decrypt message:', error, msg);
            return { ...msg, decrypted: '[Decryption Failed]' };
          }
        })
      );

      console.log('All decrypted messages:', decrypted);
      setMessages(decrypted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const startPolling = () => {
    if (polling) clearInterval(polling);
    const id = setInterval(fetchMessages, 3000);
    setPolling(id);
  };

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
      (async () => {
        try {
          await generateOrLoadKeyPair();
          await fetchUsers();
          startPolling();
        } catch (error) {
          console.error('Failed to initialize:', error);
        }
      })();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (polling) clearInterval(polling);
    };
  }, [polling]);

  if (!username) {
    return (
      <div style={{ padding: 20, fontFamily: 'Arial', maxWidth: 400 }}>
        <h2>Secure Chat - Register</h2>
        <div style={{ marginBottom: 10 }}>
          <input 
            value={inputUsername} 
            onChange={e => setInputUsername(e.target.value)} 
            placeholder="Enter username"
            style={{ padding: 8, width: '100%', marginBottom: 10 }}
            onKeyPress={e => e.key === 'Enter' && registerUser()}
          />
          <button 
            onClick={registerUser}
            style={{ padding: 8, width: '100%' }}
          >
            Register
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial', maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Welcome, {username}</h2>
        <button onClick={fetchUsers} style={{ padding: 8 }}>Refresh Users</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        <div>
          <h3>Users</h3>
          <div style={{ border: '1px solid #ccc', padding: 10, borderRadius: 4, maxHeight: 200, overflowY: 'auto' }}>
            {users.length === 0 ? (
              <p style={{ color: '#666' }}>No other users online</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {users.map(u => (
                  <li key={u.username} style={{ marginBottom: 5 }}>
                    <button 
                      onClick={() => setSelectedUser(u.username)}
                      style={{ 
                        padding: 8, 
                        width: '100%', 
                        textAlign: 'left',
                        backgroundColor: selectedUser === u.username ? '#e3f2fd' : 'white'
                      }}
                    >
                      {u.username}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedUser && (
            <div style={{ marginTop: 20 }}>
              <h3>Chat with {selectedUser}</h3>
              <textarea
                rows="3"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your message"
                style={{ width: '100%', padding: 8, marginBottom: 10 }}
                onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
              />
              <button 
                onClick={sendMessage}
                style={{ padding: 8, width: '100%' }}
                disabled={!message.trim()}
              >
                Send
              </button>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Messages</h3>
            <button 
              onClick={fetchMessages} 
              style={{ padding: 6, fontSize: 12 }}
              title="Refresh messages"
            >
              🔄 Refresh
            </button>
          </div>
          <div style={{ 
            border: '1px solid #ccc', 
            padding: 10, 
            borderRadius: 4, 
            height: 400, 
            overflowY: 'auto',
            backgroundColor: '#f9f9f9'
          }}>
            {messages.length === 0 ? (
              <p style={{ color: '#666' }}>No messages yet</p>
            ) : (
              messages.map((m, i) => (
                <div 
                  key={i} 
                  style={{ 
                    marginBottom: 10, 
                    padding: 8, 
                    backgroundColor: m.sender === username ? '#e8f5e8' : 'white',
                    borderRadius: 4,
                    marginLeft: m.sender === username ? 20 : 0,
                    marginRight: m.sender === username ? 0 : 20
                  }}
                >
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                    <strong>{m.sender}</strong> → {m.recipient} 
                    <span style={{ float: 'right' }}>
                      {new Date(m.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div>{m.decrypted}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecureChatApp;