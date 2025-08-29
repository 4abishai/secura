// hooks/useChat.js
import { useState, useCallback, useEffect } from 'react';
import { sendMessage, isWebSocketConnected, fetchUsers } from '../services/api';
import { messageStore } from '../services/messageStore';

export const useChat = () => {
  // Message state
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  
  // User state
  const [users, setUsers] = useState([]);

  // Load messages from IndexedDB when user is selected
  const loadMessagesFromStorage = useCallback(async (currentUsername, otherUsername) => {
    if (!currentUsername || !otherUsername) return;
    
    try {
      console.log(`Loading messages for conversation: ${currentUsername} <-> ${otherUsername}`);
      const storedMessages = await messageStore.getMessagesForConversation(currentUsername, otherUsername);
      console.log(`Loaded ${storedMessages.length} messages from IndexedDB`);
      setMessages(storedMessages);
    } catch (error) {
      console.error('Failed to load messages from storage:', error);
      setMessages([]);
    }
  }, []);

  // Handle new message - decrypt and store
  const handleDecryptAndAddMessage = async (messageData, handleDecryptMessage, privateKeyRef) => {
    console.log("Processing new message...");
    
    if (!privateKeyRef.current) {
      console.warn('Cannot decrypt new message: private key not available');
      return;
    }

    try {
      // Check if message already exists
      const exists = await messageStore.messageExists(messageData.id);
      if (exists) {
        console.log('Message already exists in IndexedDB, skipping');
        return;
      }

      console.log("Decrypting new message...");
      const decryptedMessage = await handleDecryptMessage(messageData);
      console.log('Decrypted message:', decryptedMessage);
      
      // Store in IndexedDB
      await messageStore.addMessage(decryptedMessage);
      
      // Update UI if this message is part of current conversation
      setMessages(prevMessages => {
        const messageExists = prevMessages.some(msg => msg.messageId === decryptedMessage.id);
        if (messageExists) return prevMessages;
        
        const updatedMessages = [...prevMessages, decryptedMessage];
        return updatedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      });
    } catch (error) {
      console.error('Failed to decrypt and store new message:', error);
    }
  };

// Send message - encrypt and store locally
const handleSendMessage = async (encryptMessage, usernameRef, privateKeyRef, overrideMessage) => {
  const textToSend = overrideMessage ?? message; // use override if provided

  if (!textToSend.trim() || !selectedUser) return;

  if (!privateKeyRef.current) {
    alert('Cannot send message: encryption key not available');
    return;
  }

  try {
    const encrypted = await encryptMessage(selectedUser, textToSend);

    // Create message object for local storage with temporary ID
    const tempId = Date.now().toString();

    // Send via WebSocket
    await sendMessage(selectedUser, encrypted, tempId);

    const messageData = {
      id: tempId,
      messageId: tempId,
      sender: usernameRef.current,
      recipient: selectedUser,
      content: encrypted,
      decrypted: textToSend,
      timestamp: new Date().toISOString(),
      pending: true
    };

    // Store & update UI
    await messageStore.addMessage(messageData);
    setMessages(prev =>
      [...prev, messageData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    );

    if (!overrideMessage) setMessage(''); // only clear input if it's the user's own input
  } catch (error) {
    console.error('Failed to send message:', error);
    alert('Failed to send message. Please try again.');
  }
};




  // Handle message history from message store (indexedDB)
  const handleDecryptMessages = async (messageList, handleDecryptMessage) => {
    try {
      const decryptedMessages = await Promise.all(
        messageList.map(async (msg) => {
          // Check if already stored
          const exists = await messageStore.messageExists(msg.id);
          if (exists) return null;
          
          return await handleDecryptMessage(msg);
        })
      );
      
      // Filter out null values and store new messages
      const newMessages = decryptedMessages.filter(msg => msg !== null);
      
      for (const msg of newMessages) {
        await messageStore.addMessage(msg);
      }
      
      console.log(`Stored ${newMessages.length} new messages in IndexedDB`);
      
    } catch (error) {
      console.error('Failed to process message history:', error);
    }
  };

  const clearMessages = async () => {
    setMessages([]);
    await messageStore.clearAllMessages();
  };

  // User handling functions (unchanged)
  const handleFetchUsers = async (username, updateUserInMap) => {
    try {
      const data = await fetchUsers();
      const filteredUsers = data.filter(u => u.username !== username);
      setUsers(filteredUsers);
      
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
    clearMessages,
    loadMessagesFromStorage,
    
    // User functions
    handleFetchUsers,
    updateUserPresence,
    clearUsers
  };
};