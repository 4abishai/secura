// src/mock/mockFetchInterceptor.js
import { mockServer } from './mockServer';

// Store original fetch
const originalFetch = window.fetch;

// Mock fetch interceptor
window.fetch = async (url, options) => {
  // Handle key bundle requests
  if (url.startsWith('/keys/')) {
    const id = url.split('/').pop();
    try {
      const bundle = mockServer.getUserBundle(id);
      return new Response(JSON.stringify(bundle), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Handle message sending
  if (url.startsWith('/messages') && options?.method === 'POST') {
    try {
      const body = JSON.parse(options.body);
      const message = mockServer.storeMessage(
        body.senderId,
        body.recipientId,
        body.encryptedMessage
      );
      
      return new Response(JSON.stringify(message), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to send message' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Handle message retrieval
  if (url.startsWith('/messages/') && options?.method === 'GET') {
    try {
      const [user1, user2] = url.split('/').slice(-2);
      const messages = mockServer.getMessages(user1, user2);
      
      return new Response(JSON.stringify(messages), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Failed to retrieve messages' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Handle user registration check
  if (url.startsWith('/users/') && options?.method === 'GET') {
    const userId = url.split('/').pop();
    const exists = mockServer.userExists(userId);
    
    return new Response(JSON.stringify({ exists }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Fall back to original fetch for other requests
  return originalFetch(url, options);
};

console.log('Mock fetch interceptor loaded');