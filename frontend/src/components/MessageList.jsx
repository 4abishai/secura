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