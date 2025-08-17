<<<<<<< Updated upstream
// components/MessageList.jsx - Enhanced Version
import React, { useRef, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import MessageSearch from './MessageSearch';

const MessageList = ({ messages, currentUsername, selectedUser }) => {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const messageRefs = useRef({});
  const containerRef = useRef(null);

  const filteredMessages = messages.filter(
    m =>
      (m.sender === currentUsername && m.recipient === selectedUser) ||
      (m.sender === selectedUser && m.recipient === currentUsername)
  );

  // Handle message found from search
  const handleMessageFound = (foundMessage, matchIndex, totalMatches) => {
    setHighlightedMessageId(foundMessage.id || foundMessage.messageId);
    
    // Scroll to the found message
    const messageElement = messageRefs.current[foundMessage.id || foundMessage.messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center'
      });
      
      // Add a temporary highlight animation
      messageElement.classList.add('search-match-highlight');
      setTimeout(() => {
        messageElement.classList.remove('search-match-highlight');
      }, 2000);
    }
  };

  // Clear highlight when search is closed
  const handleSearchClose = () => {
    setIsSearchVisible(false);
    setHighlightedMessageId(null);
  };

  // Handle keyboard shortcut for search (Ctrl+F or Cmd+F)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchVisible(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Render message content with potential highlighting
  const renderMessageContent = (message) => {
    const content = message.decrypted || message.content || '';
    
    // If this message is highlighted from search, we don't need to re-highlight
    // The search component handles highlighting in its own display
    return content;
  };

  return (
    <div className="message-list-container" ref={containerRef}>
      {/* Search Component */}
      <MessageSearch
        messages={messages}
        currentUsername={currentUsername}
        selectedUser={selectedUser}
        onMessageFound={handleMessageFound}
        isVisible={isSearchVisible}
        onClose={handleSearchClose}
      />

      {/* Header with Search Button */}
      <div className="message-list-header">
        <h3>Messages</h3>
        {selectedUser && (
          <button
            onClick={() => setIsSearchVisible(!isSearchVisible)}
            className="search-toggle-button"
            title="Search messages (Ctrl+F)"
          >
            <Search size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="messages-container">
        {!selectedUser ? (
          <div className="no-selection">
            Select a user to start chatting
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="no-messages">
            No conversation yet with {selectedUser}
          </div>
        ) : (
          filteredMessages.map((m, i) => (
            <div
              key={m.id || m.messageId || i}
              ref={el => messageRefs.current[m.id || m.messageId] = el}
              className={`message ${
                m.sender === currentUsername ? 'sent' : 'received'
              } ${
                highlightedMessageId === (m.id || m.messageId) ? 'highlighted' : ''
              }`}
            >
              <div className="message-header">
                <span className="sender">
                  {m.sender === currentUsername ? 'You' : m.sender}
                </span>
                <span className="timestamp">
                  {new Date(m.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div 
                className="message-content"
                dangerouslySetInnerHTML={{
                  __html: renderMessageContent(m)
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MessageList;
=======
import React, { useState, useMemo, useEffect } from 'react';
import { messageStore } from '../services/messageStore';

const MessageList = ({ messages, currentUsername, selectedUser }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [allMessages, setAllMessages] = useState([]);
    const [isLoadingAll, setIsLoadingAll] = useState(false);
    
    const filteredMessages = useMemo(() => {
        return messages.filter(
            m =>
                (m.sender === currentUsername && m.recipient === selectedUser) ||
                (m.sender === selectedUser && m.recipient === currentUsername)
        );
    }, [messages, currentUsername, selectedUser]);

    // Load all messages when searching globally
    useEffect(() => {
        const loadAllMessages = async () => {
            if (searchQuery.trim() && currentUsername) {
                setIsLoadingAll(true);
                try {
                    const allUserMessages = await messageStore.getAllMessages(currentUsername);
                    setAllMessages(allUserMessages);
                } catch (error) {
                    console.error('Failed to load all messages:', error);
                    setAllMessages([]);
                } finally {
                    setIsLoadingAll(false);
                }
            } else {
                setAllMessages([]);
            }
        };

        loadAllMessages();
    }, [searchQuery, currentUsername]);

    // Function to highlight search text in message content
    const highlightText = (text, query) => {
        if (!query.trim()) return text;
        
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = text.split(regex);
        
        return parts.map((part, index) => 
            regex.test(part) ? (
                <mark key={index} style={{ backgroundColor: '#ffff00', padding: '2px 4px', borderRadius: '3px' }}>
                    {part}
                </mark>
            ) : part
        );
    };

    // Filter messages globally based on search query
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        
        return allMessages.filter(message => 
            message.decrypted && 
            message.decrypted.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allMessages, searchQuery]);

    // Get messages to display - either filtered conversation or global search results
    const displayMessages = searchQuery.trim() ? searchResults : filteredMessages;
    const isSearching = searchQuery.trim().length > 0;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>
                    {isSearching ? 'Global Search Results' : 'Messages'}
                </h3>
            </div>
            
            {/* Search Bar */}
            <div style={{ marginBottom: 10 }}>
                <input
                    type="text"
                    placeholder="Search all messages across all chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                    }}
                />
                {searchQuery.trim() && (
                    <div style={{ 
                        fontSize: '12px', 
                        color: '#666', 
                        marginTop: '4px',
                        fontStyle: 'italic'
                    }}>
                        {isLoadingAll ? (
                            'Loading all messages...'
                        ) : (
                            `Found ${searchResults.length} message${searchResults.length !== 1 ? 's' : ''} matching "${searchQuery}" across all chats`
                        )}
                    </div>
                )}
            </div>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                border: '1px solid #ccc',
                padding: 10,
                borderRadius: 4,
                height: 400,
                overflowY: 'auto',
                backgroundColor: '#f9f9f9'
            }}>
                {!selectedUser && !isSearching ? (
                    <p style={{ color: '#666' }}>Select a user to start chatting</p>
                ) : !isSearching && filteredMessages.length === 0 ? (
                    <p style={{ color: '#666' }}>No conversation yet with {selectedUser}</p>
                ) : isSearching && isLoadingAll ? (
                    <p style={{ color: '#666' }}>Loading messages from all chats...</p>
                ) : isSearching && searchResults.length === 0 ? (
                    <p style={{ color: '#666' }}>No messages found matching "{searchQuery}" across all chats</p>
                ) : (
                    displayMessages.map((m, i) => (
                        <div
                            key={i}
                            style={{
                                alignSelf: m.sender === currentUsername ? 'flex-end' : 'flex-start',
                                backgroundColor: m.sender === currentUsername ? '#dcf8c6' : '#ffffff',
                                padding: 10,
                                borderRadius: 8,
                                maxWidth: '75%',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                border: searchQuery.trim() && m.decrypted && m.decrypted.toLowerCase().includes(searchQuery.toLowerCase()) 
                                    ? '2px solid #ffd700' 
                                    : 'none'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#555', marginBottom: 4, width: '100%', gap: 10, whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <span style={{ fontWeight: 'bold' }}>
                                        {m.sender === currentUsername ? 'You' : m.sender}
                                    </span>
                                    {isSearching && (
                                        <span style={{ fontSize: '10px', color: '#888' }}>
                                            {m.sender === currentUsername ? `to ${m.recipient}` : `from ${m.recipient}`}
                                        </span>
                                    )}
                                </div>
                                <span style={{ float: 'right' }}>
                                    {new Date(m.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <div>{highlightText(m.decrypted, searchQuery)}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MessageList;
>>>>>>> Stashed changes
