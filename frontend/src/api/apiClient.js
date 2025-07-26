// src/api/apiClient.js
const BASE_URL = 'http://localhost:8080/api';

class ApiClient {
  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Handle empty responses
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // User Management
  async registerUser(phoneNumber, keyBundle) {
    return this.request('/users/register', {
      method: 'POST',
      body: JSON.stringify({
        phoneNumber: phoneNumber,
        keyBundle: JSON.stringify(keyBundle)
      }),
    });
  }

  async getUserById(userId) {
    return this.request(`/users/${userId}`);
  }

  async getUserByPhone(phoneNumber) {
    return this.request(`/users/phone/${phoneNumber}`);
  }

  async getUserBundle(userId) {
    return this.request(`/users/${userId}/bundle`);
  }

  async checkUserExists(userId) {
    return this.request(`/users/${userId}/exists`);
  }

  async getAllUsers() {
    return this.request('/users');
  }

  // Message Management
  async storeMessage(senderId, recipientId, encryptedMessage) {
    return this.request('/messages', {
      method: 'POST',
      body: JSON.stringify({
        senderId,
        recipientId,
        encryptedMessage
      }),
    });
  }

  async getChatMessages(user1, user2) {
    return this.request(`/messages/chat?user1=${user1}&user2=${user2}`);
  }

  async getNewMessages(recipientId, lastMessageId = null) {
    const endpoint = lastMessageId 
      ? `/messages/recipient/${recipientId}?lastMessageId=${lastMessageId}`
      : `/messages/recipient/${recipientId}`;
    return this.request(endpoint);
  }

  async getUserMessages(userId) {
    return this.request(`/messages/user/${userId}`);
  }

  async getMessageById(messageId) {
    return this.request(`/messages/${messageId}`);
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();