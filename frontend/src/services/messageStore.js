// services/messageStore.js - Enhanced Version with Search Support
import Dexie from 'dexie';

class MessageDatabase extends Dexie {
  constructor() {
    super('SecureChatMessages');
    
    this.version(1).stores({
      messages: '++id, messageId, sender, recipient, timestamp, content, decrypted, conversationKey, pending',
      conversations: 'key, lastMessageTime, participants'
    });

    // Add search index for better performance
    this.version(2).stores({
      messages: '++id, messageId, sender, recipient, timestamp, content, decrypted, conversationKey, pending',
      conversations: 'key, lastMessageTime, participants',
      searchIndex: '++id, messageId, searchTerms, conversationKey' // New search index table
    });
  }
}

const db = new MessageDatabase();

// Helper function to create conversation key
const getConversationKey = (user1, user2) => {
  return [user1, user2].sort().join('|');
};

// Helper function to extract search terms from message content
const extractSearchTerms = (text) => {
  if (!text) return '';
  
  // Convert to lowercase and split into words, removing punctuation
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2) // Only index words longer than 2 characters
    .join(' ');
};

export const messageStore = {
  // Add a new decrypted message with search indexing
  async addMessage(messageData) {
    try {
      const conversationKey = getConversationKey(messageData.sender, messageData.recipient);
      const messageWithConversation = {
        ...messageData,
        conversationKey,
        messageId: messageData.id,
        timestamp: new Date(messageData.timestamp)
      };

      // Add message to database
      const messageId = await db.messages.add(messageWithConversation);

      // Create search index entry
      const searchTerms = extractSearchTerms(messageData.decrypted || messageData.content);
      if (searchTerms) {
        await db.searchIndex.add({
          messageId: messageData.id,
          searchTerms,
          conversationKey
        });
      }

      // Update conversation metadata
      await db.conversations.put({
        key: conversationKey,
        lastMessageTime: new Date(messageData.timestamp),
        participants: [messageData.sender, messageData.recipient]
      });

      console.log('Message stored in IndexedDB with search index:', messageData.id);
    } catch (error) {
      console.error('Failed to store message:', error);
    }
  },

  // Enhanced search functionality
  async searchMessages(currentUser, otherUser, searchTerm, options = {}) {
    try {
      const {
        limit = 50,
        caseSensitive = false,
        exactMatch = false
      } = options;

      const conversationKey = getConversationKey(currentUser, otherUser);
      const searchTermLower = caseSensitive ? searchTerm : searchTerm.toLowerCase();

      let query = db.messages.where('conversationKey').equals(conversationKey);

      // Apply search filter
      const filteredMessages = await query.filter(message => {
        const content = message.decrypted || message.content || '';
        const searchContent = caseSensitive ? content : content.toLowerCase();
        
        if (exactMatch) {
          return searchContent.includes(searchTermLower);
        } else {
          // Support partial word matching
          const words = searchTermLower.split(/\s+/);
          return words.some(word => searchContent.includes(word));
        }
      }).limit(limit).toArray();

      // Sort by timestamp (most recent first for search results)
      return filteredMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Failed to search messages:', error);
      return [];
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

  // Enhanced global search across all conversations
  async globalSearch(currentUser, searchTerm, options = {}) {
    try {
      const {
        limit = 100,
        caseSensitive = false,
        groupByConversation = true
      } = options;

      const searchTermLower = caseSensitive ? searchTerm : searchTerm.toLowerCase();

      // Search all messages for the current user
      const allMessages = await db.messages
        .filter(msg => msg.sender === currentUser || msg.recipient === currentUser)
        .filter(message => {
          const content = message.decrypted || message.content || '';
          const searchContent = caseSensitive ? content : content.toLowerCase();
          return searchContent.includes(searchTermLower);
        })
        .limit(limit)
        .toArray();

      if (groupByConversation) {
        // Group results by conversation
        const grouped = {};
        allMessages.forEach(message => {
          const key = message.conversationKey;
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(message);
        });

        // Sort within each conversation by timestamp
        Object.keys(grouped).forEach(key => {
          grouped[key].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        });

        return grouped;
      }

      // Return flat list sorted by timestamp (most recent first)
      return allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Failed to perform global search:', error);
      return groupByConversation ? {} : [];
    }
  },

  // Update message ID (keeping existing functionality)
  async updateMessageId(tempId, realId) {
    try {
      const message = await db.messages.where('messageId').equals(tempId).first();
      if (message) {
        await db.messages.update(message.id, { 
          messageId: realId,
          pending: false 
        });

        // Update search index as well
        const searchEntry = await db.searchIndex.where('messageId').equals(tempId).first();
        if (searchEntry) {
          await db.searchIndex.update(searchEntry.id, { messageId: realId });
        }

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
      await db.searchIndex.clear(); // Clear search index as well
      console.log('All messages cleared from IndexedDB');
    } catch (error) {
      console.error('Failed to clear messages:', error);
    }
  },

  // Clear messages for specific user (for logout of specific user)
  async clearMessagesForUser(username) {
    try {
      // Get conversation keys for this user
      const conversations = await db.conversations
        .filter(conv => conv.participants.includes(username))
        .toArray();
      
      const conversationKeys = conversations.map(conv => conv.key);

      // Clear messages
      await db.messages
        .filter(msg => msg.sender === username || msg.recipient === username)
        .delete();
      
      // Clear search index entries
      await db.searchIndex
        .filter(entry => conversationKeys.includes(entry.conversationKey))
        .delete();

      // Clear conversations involving this user
      await Promise.all(
        conversations.map(conv => db.conversations.delete(conv.key))
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
  },

  // Rebuild search index (useful for migrations or data cleanup)
  async rebuildSearchIndex() {
    try {
      console.log('Rebuilding search index...');
      
      // Clear existing search index
      await db.searchIndex.clear();
      
      // Get all messages
      const allMessages = await db.messages.toArray();
      
      // Rebuild index
      const indexEntries = allMessages
        .filter(msg => msg.decrypted || msg.content)
        .map(msg => ({
          messageId: msg.messageId,
          searchTerms: extractSearchTerms(msg.decrypted || msg.content),
          conversationKey: msg.conversationKey
        }))
        .filter(entry => entry.searchTerms);

      await db.searchIndex.bulkAdd(indexEntries);
      
      console.log(`Search index rebuilt with ${indexEntries.length} entries`);
    } catch (error) {
      console.error('Failed to rebuild search index:', error);
    }
  }
};