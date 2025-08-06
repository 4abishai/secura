import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  generateOrLoadKeyPair, 
  importPublicKey, 
  deriveAESKey, 
  encryptMessage, 
  decryptMessage, 
  exportKeyBytes 
} from './utils/crypto';
import { 
  registerUser, 
  loginUser, 
  fetchUsers, 
  connectWebSocket,
  disconnectWebSocket,
  registerWebSocketUser,
  sendMessage, 
  fetchMessages,
  updatePresence,
  onWebSocketMessage,
  isWebSocketConnected,
  fetchUserPublicKey
} from './services/api';

import Registration from './components/Registration';
import UserList from './components/UserList';
import MessageInput from './components/MessageInput';
import MessageList from './components/MessageList';
const SecureChatApp = () => {
  const [username, setUsername] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [privateKey, setPrivateKey] = useState(null);
  const [publicKeyBase64, setPublicKeyBase64] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLogin, setIsLogin] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [userMap, setUserMap] = useState({});
  const [keyChangeNotifications, setKeyChangeNotifications] = useState([]);

  // Refs to ensure event handlers have access to current values
  const privateKeyRef = useRef(null);
  const usernameRef = useRef('');
  const userMapRef = useRef({});

  // Helper function to update both state and ref for privateKey
  const setPrivateKeyAndRef = (key) => {
    setPrivateKey(key);
    privateKeyRef.current = key;
  };

  // Update refs when state changes
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    userMapRef.current = userMap;
  }, [userMap]);

  // Function to check if recipient's key has changed before sending
  const checkRecipientKeyChange = async (recipientUsername) => {
    try {
      const currentPublicKey = await fetchUserPublicKey(recipientUsername);
      const cachedUser = userMapRef.current[recipientUsername];
      
      if (cachedUser && cachedUser.publicKey !== currentPublicKey) {
        console.log(`Key change detected for ${recipientUsername}`);
        
        // Update the user map with new key
        setUserMap(prev => ({
          ...prev,
          [recipientUsername]: {
            ...prev[recipientUsername],
            publicKey: currentPublicKey
          }
        }));

        // Update the users array
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.username === recipientUsername 
              ? { ...user, publicKey: currentPublicKey }
              : user
          )
        );

        // Show notification to user
        setKeyChangeNotifications(prev => [
          ...prev,
          {
            id: Date.now(),
            username: recipientUsername,
            message: `${recipientUsername}'s security key has been updated. Messages will use the new key.`,
            timestamp: new Date().toISOString()
          }
        ]);

        return currentPublicKey;
      }
      
      return cachedUser ? cachedUser.publicKey : currentPublicKey;
    } catch (error) {
      console.error('Error checking recipient key change:', error);
      throw error;
    }
  };

  // Function to validate sender's key when receiving messages
  const validateSenderKey = async (senderUsername, messageTimestamp) => {
    try {
      const currentPublicKey = await fetchUserPublicKey(senderUsername);
      const cachedUser = userMapRef.current[senderUsername];
      
      if (cachedUser && cachedUser.publicKey !== currentPublicKey) {
        console.log(`Sender key change detected for ${senderUsername}`);
        
        // Update the user map with new key
        setUserMap(prev => ({
          ...prev,
          [senderUsername]: {
            ...prev[senderUsername],
            publicKey: currentPublicKey
          }
        }));

        // Update the users array
        setUsers(prevUsers => 
          prevUsers.map(user => 
            user.username === senderUsername 
              ? { ...user, publicKey: currentPublicKey }
              : user
          )
        );

        // Show notification about key change
        setKeyChangeNotifications(prev => [
          ...prev,
          {
            id: Date.now(),
            username: senderUsername,
            message: `${senderUsername} logged in from a new device. Their security key has been updated.`,
            timestamp: new Date().toISOString()
          }
        ]);

        return currentPublicKey;
      }
      
      return cachedUser ? cachedUser.publicKey : currentPublicKey;
    } catch (error) {
      console.error('Error validating sender key:', error);
      return null;
    }
  };

  const handleDecryptMessage = async (msg) => {
    try {
      if (!privateKeyRef.current) {
        console.warn('Cannot decrypt: private key not available');
        return { ...msg, decrypted: '[Key not available]' };
      }

      const currentUsername = usernameRef.current;
      const otherUsername = msg.sender === currentUsername ? msg.recipient : msg.sender;
      
      // Validate sender's key if this is an incoming message
      let otherUserPublicKey;
      if (msg.sender !== currentUsername) {
        otherUserPublicKey = await validateSenderKey(otherUsername, msg.timestamp);
        if (!otherUserPublicKey) {
          return { ...msg, decrypted: '[Key validation failed]' };
        }
      } else {
        // For outgoing messages, use cached key
        const otherUser = userMapRef.current[otherUsername];
        if (!otherUser) {
          console.warn(`Could not find user: ${otherUsername}`);
          return { ...msg, decrypted: `[Unknown user: ${otherUsername}]` };
        }
        otherUserPublicKey = otherUser.publicKey;
      }

      const otherUserPubKey = await importPublicKey(otherUserPublicKey);
      const aesKey = await deriveAESKey(privateKeyRef.current, otherUserPubKey);

      const keyHex = await exportKeyBytes(aesKey);
      console.log(`[${currentUsername}] Shared key with ${otherUsername}: ${keyHex}`);

      const decryptedText = await decryptMessage(aesKey, msg.content);
      return { ...msg, decrypted: decryptedText };
    } catch (error) {
      console.error('Failed to decrypt message:', error, msg);
      return { ...msg, decrypted: '[Decryption Failed - Possible key mismatch]' };
    }
  };

  const handleDecryptMessages = async (messageList) => {
    if (!privateKeyRef.current) {
      console.warn('Cannot decrypt messages: private key not available');
      return;
    }

    try {
      const decrypted = await Promise.all(
        messageList.map(handleDecryptMessage)
      );

      setMessages(decrypted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    } catch (error) {
      console.error('Failed to decrypt messages:', error);
    }
  };

  const handleDecryptAndAddMessage = async (messageData) => {
    console.log("Processing new message...");

    // Log private key availability
    console.log('Private Key available:', !!privateKeyRef.current);
    console.log('Message Data:', messageData);

    if (!privateKeyRef.current) {
      console.warn('Cannot decrypt new message: private key not available');
      return;
    }

    try {
      console.log("Decrypting message...");
      const decryptedMessage = await handleDecryptMessage(messageData);

      // Log the decrypted message here
      console.log('Decrypted message:', decryptedMessage);
      
      setMessages(prevMessages => {
        // Check if message already exists to avoid duplicates
        const messageExists = prevMessages.some(msg => msg.id === decryptedMessage.id);
        if (messageExists) return prevMessages;

        const updatedMessages = [...prevMessages, decryptedMessage];
        return updatedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      });
    } catch (error) {
      console.error('Failed to decrypt new message:', error);
    }
  };

  // WebSocket event handlers
  const setupWebSocketHandlers = useCallback(() => {
    // Handle new incoming messages
    const unsubscribeNewMessage = onWebSocketMessage('new_message', async (data) => {
      console.log('Received new message:', data);
      await handleDecryptAndAddMessage(data);
    });

    // Handle message history
    const unsubscribeMessageHistory = onWebSocketMessage('messages_history', async (data) => {
      console.log('Received message history:', data);
      await handleDecryptMessages(data.messages);
    });

    // Handle message sent confirmation
    const unsubscribeMessageSent = onWebSocketMessage('message_sent', (data) => {
      console.log('Message sent confirmation:', data);
    });

    // Handle user presence updates
    const unsubscribeUserPresence = onWebSocketMessage('user_presence', (data) => {
      console.log('User presence update:', data);
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.username === data.username 
            ? { ...user, online: data.online, lastSeen: data.lastSeen }
            : user
        )
      );
    });

    // Handle registration success
    const unsubscribeRegistration = onWebSocketMessage('registration_success', (data) => {
      console.log('WebSocket registration successful:', data);
      setConnectionStatus('connected');
    });

    // Handle errors
    const unsubscribeError = onWebSocketMessage('error', (data) => {
      console.error('WebSocket error:', data.message);
      alert(`WebSocket error: ${data.message}`);
    });

    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageHistory();
      unsubscribeMessageSent();
      unsubscribeUserPresence();
      unsubscribeRegistration();
      unsubscribeError();
    };
  }, []); // Remove dependencies since we're using refs

  const handleRegisterUser = async () => {
    if (!inputUsername.trim()) {
      alert('Please enter a username');
      return;
    }

    if (!inputPassword.trim()) {
      alert('Please enter password');
      return;
    }

    try {
      const { privateKey: privKey, publicKey: pubKey } = await generateOrLoadKeyPair();

      // HTTP registration/login
      if (!isLogin) {
        await registerUser(inputUsername, pubKey, inputPassword);
      } else {
        await loginUser(inputUsername, pubKey, inputPassword);
      }

      localStorage.setItem('username', inputUsername);
      setUsername(inputUsername);
      setPrivateKeyAndRef(privKey); // Use helper function
      setPublicKeyBase64(pubKey);

      // Connect to WebSocket
      setConnectionStatus('connecting');
      await connectWebSocket();
      
      // Register user with WebSocket
      registerWebSocketUser(inputUsername);

      await handleFetchUsers();
    } catch (error) {
      console.error('Authentication error:', error);
      alert(`${isLogin ? 'Login' : 'Registration'} failed: ${error.message}`);
      setConnectionStatus('disconnected');
    }
  };

  const handleFetchUsers = async () => {
    try {
      const data = await fetchUsers();
      const filteredUsers = data.filter(u => u.username !== usernameRef.current);
      setUsers(filteredUsers);

      // Create user map for quick lookup
      const map = {};
      data.forEach(user => {
        map[user.username] = user;
      });
      setUserMap(map);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedUser) return;

    if (!privateKeyRef.current) {
      alert('Cannot send message: encryption key not available');
      return;
    }

    try {
      // Check if recipient's key has changed before sending
      const currentRecipientKey = await checkRecipientKeyChange(selectedUser);
      
      const recipientPubKey = await importPublicKey(currentRecipientKey);
      const aesKey = await deriveAESKey(privateKeyRef.current, recipientPubKey);

      const keyHex = await exportKeyBytes(aesKey);
      console.log(`[${usernameRef.current}] Shared key with ${selectedUser}: ${keyHex}`);

      const encrypted = await encryptMessage(aesKey, message);
      
      // Send via WebSocket
      await sendMessage(selectedUser, encrypted);

      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. The recipient may have logged in from a new device. Please try again.');
    }
  };

  const handleFetchMessages = async () => {
    if (!usernameRef.current || !privateKeyRef.current || !isWebSocketConnected()) {
      console.warn('Cannot fetch messages: missing requirements', {
        username: !!usernameRef.current,
        privateKey: !!privateKeyRef.current,
        websocket: isWebSocketConnected()
      });
      return;
    }

    try {
      fetchMessages(); // This triggers the WebSocket request
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const dismissKeyNotification = (notificationId) => {
    setKeyChangeNotifications(prev => 
      prev.filter(notification => notification.id !== notificationId)
    );
  };

  const initializeApp = async (storedUsername) => {
    try {
      console.log('Initializing app for:', storedUsername);
      const { privateKey: privKey, publicKey: pubKey } = await generateOrLoadKeyPair();
      console.log('Keys generated/loaded successfully');
      
      setPrivateKeyAndRef(privKey); // Use helper function
      setPublicKeyBase64(pubKey);

      setConnectionStatus('connecting');
      await connectWebSocket();
      registerWebSocketUser(storedUsername);

      await handleFetchUsers();
      console.log('App initialization complete');
    } catch (error) {
      console.error('Failed to initialize:', error);
      setConnectionStatus('disconnected');
    }
  };

  // Setup WebSocket handlers once on mount
  useEffect(() => {
    console.log('Setting up WebSocket handlers');
    const cleanup = setupWebSocketHandlers();
    
    return () => {
      cleanup();
    };
  }, [setupWebSocketHandlers]);

  // Handle initial app setup
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      console.log('Found stored username:', storedUsername);
      setUsername(storedUsername);
      initializeApp(storedUsername);
    }

    return () => {
      disconnectWebSocket();
    };
  }, []); // Run once on mount

  // Update presence on window focus/blur
  useEffect(() => {
    const handleFocus = () => {
      if (usernameRef.current && isWebSocketConnected()) {
        updatePresence(true);
      }
    };

    const handleBlur = () => {
      if (usernameRef.current && isWebSocketConnected()) {
        updatePresence(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Auto-refresh messages when connection is established or user is selected
  useEffect(() => {
    if (connectionStatus === 'connected' && username && privateKeyRef.current) {
      console.log('Connection ready, fetching messages');
      handleFetchMessages();
    }
  }, [connectionStatus, username, selectedUser]);

  if (!username) {
    return (
      <Registration 
        inputUsername={inputUsername}
        inputPassword={inputPassword}
        onUsernameChange={setInputUsername}
        onPasswordChange={setInputPassword}
        onRegister={handleRegisterUser}
        isLogin={isLogin}
        onToggleMode={() => setIsLogin(!isLogin)}
      />
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial', maxWidth: 800 }}>
      {/* Key Change Notifications */}
      {keyChangeNotifications.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {keyChangeNotifications.map(notification => (
            <div 
              key={notification.id}
              style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: 4,
                padding: 10,
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <strong>🔑 Security Key Updated</strong>
                <div style={{ fontSize: '14px', marginTop: 5 }}>
                  {notification.message}
                </div>
              </div>
              <button 
                onClick={() => dismissKeyNotification(notification.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Welcome, {username}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span 
            style={{ 
              color: connectionStatus === 'connected' ? 'green' : 
                     connectionStatus === 'connecting' ? 'orange' : 'red',
              fontSize: '12px'
            }}
          >
            ● {connectionStatus.toUpperCase()}
          </span>
          <span style={{ fontSize: '12px', color: privateKey ? 'green' : 'red' }}>
            🔑 {privateKey ? 'KEY OK' : 'NO KEY'}
          </span>
          <button onClick={() => {
            localStorage.removeItem('username');
            disconnectWebSocket();
            setUsername('');
            setPrivateKeyAndRef(null);
            setMessages([]);
            setUsers([]);
            setSelectedUser(null);
            setConnectionStatus('disconnected');
            setKeyChangeNotifications([]);
          }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        <div>
          <UserList 
            users={users}
            selectedUser={selectedUser}
            onUserSelect={setSelectedUser}
            onRefresh={handleFetchUsers}
          />

          <MessageInput 
            selectedUser={selectedUser}
            message={message}
            onMessageChange={setMessage}
            onSendMessage={handleSendMessage}
            disabled={connectionStatus !== 'connected' || !privateKey}
          />
        </div>

        <MessageList 
          messages={messages}
          currentUsername={username}
          selectedUser={selectedUser}
        />
      </div>
    </div>
  );
};

export default SecureChatApp;