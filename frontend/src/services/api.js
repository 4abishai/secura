const apiBase = 'http://localhost:3000';

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
    throw new Error(`Registration failed: ${errorText}`);
  }

  return res;
};

export const fetchUsers = async () => {
  const res = await fetch(`${apiBase}/users`);
  if (!res.ok) throw new Error('Failed to fetch users');
  return await res.json();
};

export const sendMessage = async (messageData) => {
  const res = await fetch(`${apiBase}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messageData)
  });

  if (!res.ok) throw new Error('Failed to send message');
  return res;
};

export const fetchMessages = async (username) => {
  const res = await fetch(`${apiBase}/messages?user=${username}`);
  if (!res.ok) throw new Error('Failed to fetch messages');
  return await res.json();
};