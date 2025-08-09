// src/hooks/useAuth.js
import { useState, useRef, useEffect } from 'react';
import { generateOrLoadKeyPair } from '../utils/keyUtils';
import { registerUser, loginUser, connectWebSocket, registerWebSocketUser, fetchUserPublicKey } from '../services/api';
import { messageUtils } from '../utils/messageUtils';

export const useAuth = () => {
  const [username, setUsername] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [privateKey, setPrivateKey] = useState(null);
  const [publicKeyBase64, setPublicKeyBase64] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  
  // Key management state
  const [userMap, setUserMap] = useState({});
  const [keyChangeNotifications, setKeyChangeNotifications] = useState([]);

  // Refs to ensure event handlers have access to current values
  const privateKeyRef = useRef(null);
  const usernameRef = useRef('');
  const userMapRef = useRef({});

  // Update refs when state changes
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    privateKeyRef.current = privateKey;
  }, [privateKey]);

  useEffect(() => {
    userMapRef.current = userMap;
  }, [userMap]);

  const setPrivateKeyAndRef = (key) => {
    setPrivateKey(key);
    privateKeyRef.current = key;
  };

  // Key change detection and validation
  const checkRecipientKeyChange = async (recipientUsername) => {
    try {
      const currentPublicKey = await fetchUserPublicKey(recipientUsername);
      const cachedUser = userMapRef.current[recipientUsername];
      
      if (cachedUser && cachedUser.publicKey !== currentPublicKey) {
        console.log(`Key change detected for ${recipientUsername}`);
        
        setUserMap(prev => ({
          ...prev,
          [recipientUsername]: {
            ...prev[recipientUsername],
            publicKey: currentPublicKey
          }
        }));

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

  const validateSenderKey = async (senderUsername, messageTimestamp) => {
    try {
      const currentPublicKey = await fetchUserPublicKey(senderUsername);
      const cachedUser = userMapRef.current[senderUsername];
      
      if (cachedUser && cachedUser.publicKey !== currentPublicKey) {
        console.log(`Sender key change detected for ${senderUsername}`);
        
        setUserMap(prev => ({
          ...prev,
          [senderUsername]: {
            ...prev[senderUsername],
            publicKey: currentPublicKey
          }
        }));

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

  // Message encryption/decryption
  const handleDecryptMessage = async (msg) => {
    try {
      if (!privateKeyRef.current) {
        console.warn('Cannot decrypt: private key not available');
        return { ...msg, decrypted: '[Key not available]' };
      }

      const currentUsername = usernameRef.current;
      const otherUsername = msg.sender === currentUsername ? msg.recipient : msg.sender;
      
      let otherUserPublicKey;
      if (msg.sender !== currentUsername) {
        otherUserPublicKey = await validateSenderKey(otherUsername, msg.timestamp);
        if (!otherUserPublicKey) {
          return { ...msg, decrypted: '[Key validation failed]' };
        }
      } else {
        const otherUser = userMapRef.current[otherUsername];
        if (!otherUser) {
          console.warn(`Could not find user: ${otherUsername}`);
          return { ...msg, decrypted: `[Unknown user: ${otherUsername}]` };
        }
        otherUserPublicKey = otherUser.publicKey;
      }

      const decryptedText = await messageUtils.decryptMessage(
        privateKeyRef.current, 
        otherUserPublicKey, 
        msg.content, 
        currentUsername, 
        otherUsername
      );
      
      return { ...msg, decrypted: decryptedText };
    } catch (error) {
      console.error('Failed to decrypt message:', error, msg);
      return { ...msg, decrypted: '[Decryption Failed - Possible key mismatch]' };
    }
  };

  const encryptMessage = async (recipientUsername, message) => {
    if (!privateKeyRef.current) {
      throw new Error('Cannot encrypt message: private key not available');
    }

    const currentRecipientKey = await checkRecipientKeyChange(recipientUsername);
    
    const encryptedMessage = await messageUtils.encryptMessage(
      privateKeyRef.current,
      currentRecipientKey,
      message,
      usernameRef.current,
      recipientUsername
    );

    return encryptedMessage;
  };

  // Authentication functions
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
      
      if (!isLogin) {
        await registerUser(inputUsername, pubKey, inputPassword);
      } else {
        await loginUser(inputUsername, pubKey, inputPassword);
      }
      
      localStorage.setItem('username', inputUsername);
      setUsername(inputUsername);
      setPrivateKeyAndRef(privKey);
      setPublicKeyBase64(pubKey);
      
      await connectWebSocket();
      registerWebSocketUser(inputUsername);
      
      return { success: true, privateKey: privKey, publicKey: pubKey };
    } catch (error) {
      console.error('Authentication error:', error);
      alert(`${isLogin ? 'Login' : 'Registration'} failed: ${error.message}`);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('privateKey');
    localStorage.removeItem('publicKey');
    setUsername('');
    setPrivateKeyAndRef(null);
    setInputUsername('');
    setInputPassword('');
    setUserMap({});
    setKeyChangeNotifications([]);
  };

  const initializeAuth = async (storedUsername) => {
    try {
      console.log('Initializing auth for:', storedUsername);
      const { privateKey: privKey, publicKey: pubKey } = await generateOrLoadKeyPair();
      console.log('Keys generated/loaded successfully');
      
      setPrivateKeyAndRef(privKey);
      setPublicKeyBase64(pubKey);
      await connectWebSocket();
      registerWebSocketUser(storedUsername);
      return { success: true, privateKey: privKey, publicKey: pubKey };
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      throw error;
    }
  };

  // User map management
  const updateUserInMap = (username, userData) => {
    setUserMap(prev => ({
      ...prev,
      [username]: userData
    }));
  };

  const dismissKeyNotification = (notificationId) => {
    setKeyChangeNotifications(prev => 
      prev.filter(notification => notification.id !== notificationId)
    );
  };

  return {
    // Auth state
    username,
    setUsername,
    inputUsername,
    setInputUsername,
    inputPassword,
    setInputPassword,
    privateKey,
    publicKeyBase64,
    isLogin,
    setIsLogin,
    
    // Key management state
    userMap,
    setUserMap,
    keyChangeNotifications,
    
    // Refs
    privateKeyRef,
    usernameRef,
    userMapRef,
    
    // Auth functions
    handleRegisterUser,
    logout,
    initializeAuth,
    setPrivateKeyAndRef,
    
    // Encryption functions
    handleDecryptMessage,
    encryptMessage,
    checkRecipientKeyChange,
    validateSenderKey,
    updateUserInMap,
    dismissKeyNotification
  };
};