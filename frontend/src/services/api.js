// services/api.js
import websocketService from './websocket';

const apiBase = 'http://localhost:3000/api';

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

export const onWebSocketMessage = (type, handler) => {
  return websocketService.onMessage(type, handler);
};

export const isWebSocketConnected = () => {
  return websocketService.isConnected();
};

export const summarizeMessages = async (messages) => {
  try {
    const res = await fetch(`${apiBase}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: messages.map(m => ({
          sender: m.sender,
          content: m.decrypted,
        }))
      }),
    });

    if (!res.ok) {
      throw new Error(`Summarization failed: ${await res.text()}`);
    }
    return await res.json();
  } catch (err) {
    console.error("Error summarizing messages:", err);
    throw err;
  }
};

export const callAI = async (query) => {
  try {
    const res = await fetch(`${apiBase}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      return `HTTP error: ${res.status} ${res.statusText}`;
    }

    const data = await res.json();
    return data.response; // API only returns response on success
  } catch (error) {
    console.error('Error calling AI:', error);
    return `Error calling AI: ${error.message}`;
  }
};