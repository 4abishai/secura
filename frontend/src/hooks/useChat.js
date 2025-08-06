import { useState } from 'react';
import { fetchMessages, sendMessage, isWebSocketConnected, fetchUsers } from '../services/api';

export const useChat = () => {
  // Message state
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  // User state
  const [users, setUsers] = useState([]);

  // Message handling functions
  const handleDecryptMessages = async (messageList, handleDecryptMessage) => {
    try {
      const decrypted = await Promise.all(
        messageList.map(handleDecryptMessage)
      );
      setMessages(decrypted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    } catch (error) {
      console.error('Failed to decrypt messages:', error);
    }
  };

  const handleDecryptAndAddMessage = async (messageData, handleDecryptMessage, privateKeyRef) => {
    console.log("Processing new message...");
    console.log('Private Key available:', !!privateKeyRef.current);
    console.log('Message Data:', messageData);
    
    if (!privateKeyRef.current) {
      console.warn('Cannot decrypt new message: private key not available');
      return;
    }

    try {
      console.log("Decrypting message...");
      const decryptedMessage = await handleDecryptMessage(messageData);
      console.log('Decrypted message:', decryptedMessage);
      
      setMessages(prevMessages => {
        const messageExists = prevMessages.some(msg => msg.id === decryptedMessage.id);
        if (messageExists) return prevMessages;
        
        const updatedMessages = [...prevMessages, decryptedMessage];
        return updatedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      });
    } catch (error) {
      console.error('Failed to decrypt new message:', error);
    }
  };

  const handleSendMessage = async (encryptMessage, usernameRef, privateKeyRef) => {
    if (!message.trim() || !selectedUser) return;
    
    if (!privateKeyRef.current) {
      alert('Cannot send message: encryption key not available');
      return;
    }

    try {
      const encrypted = await encryptMessage(selectedUser, message);
      await sendMessage(selectedUser, encrypted);
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. The recipient may have logged in from a new device. Please try again.');
    }
  };

  const handleFetchMessages = async (usernameRef, privateKeyRef) => {
    if (!usernameRef.current || !privateKeyRef.current || !isWebSocketConnected()) {
      console.warn('Cannot fetch messages: missing requirements', {
        username: !!usernameRef.current,
        privateKey: !!privateKeyRef.current,
        websocket: isWebSocketConnected()
      });
      return;
    }

    try {
      fetchMessages();
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  // User handling functions
  const handleFetchUsers = async (username, updateUserInMap) => {
    try {
      const data = await fetchUsers();
      const filteredUsers = data.filter(u => u.username !== username);
      setUsers(filteredUsers);
      
      // Create user map for quick lookup
      data.forEach(user => {
        updateUserInMap(user.username, user);
      });
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const updateUserPresence = (username, online, lastSeen) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.username === username 
          ? { ...user, online, lastSeen }
          : user
      )
    );
  };

  const updateUserKey = (username, publicKey) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.username === username 
          ? { ...user, publicKey }
          : user
      )
    );
  };

  const clearUsers = () => {
    setUsers([]);
  };

  return {
    // Message state
    messages,
    setMessages,
    message,
    setMessage,
    selectedUser,
    setSelectedUser,
    
    // User state
    users,
    setUsers,
    
    // Message functions
    handleDecryptMessages,
    handleDecryptAndAddMessage,
    handleSendMessage,
    handleFetchMessages,
    clearMessages,
    
    // User functions
    handleFetchUsers,
    updateUserPresence,
    updateUserKey,
    clearUsers
  };
};