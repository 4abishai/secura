// services/messageStore.js
import Dexie from 'dexie';

class MessageDatabase extends Dexie {
  constructor() {
    super('SecureChatMessages');
    
    this.version(1).stores({
      messages: '++id, messageId, sender, recipient, timestamp, content, decrypted, conversationKey, pending',
      conversations: 'key, lastMessageTime, participants'
    });
  }
}

const db = new MessageDatabase();

// Helper function to create conversation key
const getConversationKey = (user1, user2) => {
  return [user1, user2].sort().join('|');
};

export const messageStore = {
  // Add a new decrypted message
  async addMessage(messageData) {
    try {
      const conversationKey = getConversationKey(messageData.sender, messageData.recipient);
      const messageWithConversation = {
        ...messageData,
        conversationKey,
        messageId: messageData.id, // Store original message ID
        timestamp: new Date(messageData.timestamp)
      };

      // Add message to database
      await db.messages.add(messageWithConversation);

      // Update conversation metadata
      await db.conversations.put({
        key: conversationKey,
        lastMessageTime: new Date(messageData.timestamp),
        participants: [messageData.sender, messageData.recipient]
      });

      console.log('Message stored in IndexedDB:', messageData.id);
    } catch (error) {
      console.error('Failed to store message:', error);
    }
  },

  // Get messages for a specific conversation
  async getMessagesForConversation(currentUser, otherUser) {
    try {
      const conversationKey = getConversationKey(currentUser, otherUser);
      const messages = await db.messages
        .where('conversationKey')
        .equals(conversationKey)
        .toArray();
      
      // Sort by timestamp after retrieval
      return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (error) {
      console.error('Failed to fetch messages from IndexedDB:', error);
      return [];
    }
  },

  // Get all messages for current user
  async getAllMessages(currentUser) {
    try {
      const messages = await db.messages
        .filter(msg => msg.sender === currentUser || msg.recipient === currentUser)
        .toArray();
      
      // Sort by timestamp after retrieval
      return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } catch (error) {
      console.error('Failed to fetch all messages from IndexedDB:', error);
      return [];
    }
  },

// services/messageStore.js
async updateMessageId(tempId, realId) {
  try {
    // Search using messageId instead of Dexie's auto-incremented primary key
    const message = await db.messages.where('messageId').equals(tempId).first();
    if (message) {
      await db.messages.update(message.id, { 
        messageId: realId,
        pending: false 
      });
      console.log(`Updated messageId from ${tempId} to ${realId} and cleared pending`);
    } else {
      console.warn(`No message found with tempId/messageId: ${tempId}`);
    }
  } catch (error) {
    console.error('Failed to update messageId:', error);
  }
},


  // Check if message already exists
  async messageExists(messageId) {
    try {
      const count = await db.messages.where('messageId').equals(messageId).count();
      return count > 0;
    } catch (error) {
      console.error('Failed to check message existence:', error);
      return false;
    }
  },

  // Clear all messages (for logout)
  async clearAllMessages() {
    try {
      await db.messages.clear();
      await db.conversations.clear();
      console.log('All messages cleared from IndexedDB');
    } catch (error) {
      console.error('Failed to clear messages:', error);
    }
  },

  // Clear messages for specific user (for logout of specific user)
  async clearMessagesForUser(username) {
    try {
      await db.messages
        .filter(msg => msg.sender === username || msg.recipient === username)
        .delete();
      
      // Clear conversations involving this user
      const conversations = await db.conversations.toArray();
      const conversationsToDelete = conversations.filter(conv => 
        conv.participants.includes(username)
      );
      
      await Promise.all(
        conversationsToDelete.map(conv => db.conversations.delete(conv.key))
      );
      
      console.log(`Messages for user ${username} cleared from IndexedDB`);
    } catch (error) {
      console.error('Failed to clear messages for user:', error);
    }
  },

  // Get conversation list with last message info
  async getConversations(currentUser) {
    try {
      const conversations = await db.conversations
        .filter(conv => conv.participants.includes(currentUser))
        .toArray();
      
      // Sort by lastMessageTime (most recent first)
      return conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      return [];
    }
  }
};
