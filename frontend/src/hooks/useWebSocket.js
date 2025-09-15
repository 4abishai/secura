// src/hooks/useWebSocket.js

import { useState, useCallback, useEffect } from 'react';
import { 
  onWebSocketMessage, 
  disconnectWebSocket, 
  updatePresence, 
  isWebSocketConnected,
  sendMessageAck,
  sendWebSocketMessage
} from '../services/api';
import { messageStore } from '../services/messageStore';

export const useWebSocket = (username) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Presence management - automatically handle focus/blur events
  useEffect(() => {
    if (!username) return;

    const handleFocus = () => {
      if (username && isWebSocketConnected()) {
        updatePresence(true);
      }
    };

    const handleBlur = () => {
      if (username && isWebSocketConnected()) {
        updatePresence(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [username]);

const setupWebSocketHandlers = useCallback((
  handleDecryptAndAddMessage, 
  handleDecryptMessages, 
  updateUserPresence,
  handleDecryptMessage,
  privateKeyRef,
  handleTasksUpdate
) => {


    // Handle new incoming messages
const unsubscribeNewMessage = onWebSocketMessage('new_message', async (data) => {
  console.log('Received new message:', data);

  // Send ACK back to server
  if (data.id) {
    try {
      sendMessageAck(data.id);
    } catch (err) {
      console.error('Failed to send ACK:', err);
    }
}
  
  await handleDecryptAndAddMessage(
    { ...data, pending: false }, // Receiver always gets delivered message
    handleDecryptMessage,        // Pass the decryption fn from outside
    privateKeyRef                // Pass private key ref from outside
  );
});


    // Handle message history
    const unsubscribeMessageHistory = onWebSocketMessage('messages_history', async (data) => {
      console.log('Received message history:', data);
      await handleDecryptMessages(data.messages);
    });

const unsubscribeMessageSent = onWebSocketMessage('message_sent', async (data) => {
  console.log('Message sent confirmation:', data);
  
  if (data.tempId && data.messageId) {
    await messageStore.updateMessageId(data.tempId, data.messageId);
  }
});


    // Handle user presence updates
    const unsubscribeUserPresence = onWebSocketMessage('user_presence', (data) => {
      console.log('User presence update:', data);
      updateUserPresence(data.username, data.online, data.lastSeen);
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

    // Handle pending tasks
    const unsubscribePendingTasks = onWebSocketMessage('pending_tasks', (data) => {
      console.log('Received pending tasks:', data);
        if (handleTasksUpdate) {
          handleTasksUpdate(data.tasks); // notify parent
        }
    });

    // Return cleanup function
    return () => {
      unsubscribeNewMessage();
      unsubscribeMessageHistory();
      unsubscribeMessageSent();
      unsubscribeUserPresence();
      unsubscribeRegistration();
      unsubscribePendingTasks();
      unsubscribeError();
    };
  }, []);

  // Manual presence controls
  const setOnline = () => {
    if (username && isWebSocketConnected()) {
      updatePresence(true);
    }
  };

  const setOffline = () => {
    if (username && isWebSocketConnected()) {
      updatePresence(false);
    }
  };

  // Connection management
  const disconnect = () => {
    disconnectWebSocket();
    setConnectionStatus('disconnected');
  };

  const isConnected = () => {
    return isWebSocketConnected();
  };

  return {
    // Connection state
    connectionStatus,
    setConnectionStatus,
    
    // Setup functions
    setupWebSocketHandlers,
    
    // Presence controls
    setOnline,
    setOffline,
    
    // Connection controls
    disconnect,
    isConnected,

    send: sendWebSocketMessage
  };
};