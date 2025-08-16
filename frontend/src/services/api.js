// services/api.js
import websocketService from './websocket';

const apiBase = "http://localhost:3000"

import axios from 'axios';



// Configure axios defaults
axios.defaults.withCredentials = true;

// Add this new search API function to your existing api.js
export const searchMessages = async (currentUser, otherUser, query, options = {}) => {
  try {
    const {
      limit = 50,
      caseSensitive = false,
      exactMatch = false
    } = options;

    const response = await axios.get(`${API_BASE_URL}/api/messages/search`, {
      params: {
        currentUser,
        otherUser,
        query,
        limit,
        caseSensitive,
        exactMatch
      },
      withCredentials: true
    });

    return response.data;
  } catch (error) {
    console.error('Search API failed:', error);
    throw error;
  }
};

// Enhanced message fetching with search capability
export const fetchMessagesWithSearch = async (currentUser, otherUser) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/messages/${otherUser}`, {
      params: { currentUser },
      withCredentials: true
    });

    return response.data;
  } catch (error) {
    console.error('Fetch messages failed:', error);
    throw error;
  }
};


// HTTP endpoints (registration, login, users list remain HTTP)
export const registerUser = async (username, publicKey, password) => {
  const res = await fetch(`${apiBase}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, publicKey })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Registration failed: ${errorText}`);
  }

  return res;
};

export const loginUser = async (username, publicKey, password) => {
  const res = await fetch(`${apiBase}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, publicKey })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Login failed: ${errorText}`);
  }

  return res;
};

export const fetchUserPublicKey = async (username) => {
  try {
    const res = await fetch(`${apiBase}/users/${username}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch public key for user ${username}`);
    }
    const data = await res.json();
    return data.publicKey;
  } catch (err) {
    console.error('API fetchUserPublicKey error:', err);
    throw err;
  }
};


export const fetchUsers = async () => {
  const res = await fetch(`${apiBase}/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return await res.json();
};

// WebSocket-based message functions
export const connectWebSocket = async (wsUrl) => {
  return await websocketService.connect(wsUrl);
};

export const disconnectWebSocket = () => {
  websocketService.disconnect();
};

export const registerWebSocketUser = (username) => {
  return websocketService.registerUser(username);
};

export const sendMessage = async (recipient, content, tempId) => {
  if (!websocketService.isConnected()) {
    throw new Error('WebSocket not connected');
  }
  return websocketService.sendMessage(recipient, content, tempId);
};

export const sendMessageAck = (messageId) => {
    if (websocketService.isConnected()) {
        websocketService.send({ type: 'message_ack', messageId });
    }
};

export const updatePresence = (online) => {
  if (websocketService.isConnected()) {
    return websocketService.updatePresence(online);
  }
};

// WebSocket event handlers
export const onWebSocketMessage = (type, handler) => {
  return websocketService.onMessage(type, handler);
};

export const isWebSocketConnected = () => {
  return websocketService.isConnected();
};