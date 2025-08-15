// components/MessageSearch.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';

const MessageSearch = ({ 
  messages, 
  currentUsername, 
  selectedUser, 
  onMessageFound,
  isVisible,
  onClose 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [matchedMessages, setMatchedMessages] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Filter messages for current conversation
  const conversationMessages = messages.filter(
    m => (m.sender === currentUsername && m.recipient === selectedUser) ||
         (m.sender === selectedUser && m.recipient === currentUsername)
  );

  // Focus search input when component becomes visible
  useEffect(() => {
    if (isVisible && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isVisible]);

  // Debounced search functionality
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      performSearch();
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, conversationMessages]);

  const performSearch = () => {
    if (!searchTerm.trim()) {
      setMatchedMessages([]);
      setCurrentMatchIndex(0);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const searchTermLower = searchTerm.toLowerCase();
    
    const matches = conversationMessages
      .map((message, originalIndex) => ({
        ...message,
        originalIndex,
        highlightedText: highlightSearchTerm(message.decrypted || message.content, searchTerm)
      }))
      .filter(message => 
        (message.decrypted || message.content || '').toLowerCase().includes(searchTermLower)
      );

    setMatchedMessages(matches);
    setCurrentMatchIndex(0);
    setIsSearching(false);

    // Notify parent component about the current match
    if (matches.length > 0 && onMessageFound) {
      onMessageFound(matches[0], 0, matches.length);
    }
  };

  const highlightSearchTerm = (text, term) => {
    if (!text || !term) return text;
    
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  };

  const navigateToMatch = (direction) => {
    if (matchedMessages.length === 0) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = currentMatchIndex < matchedMessages.length - 1 ? currentMatchIndex + 1 : 0;
    } else {
      newIndex = currentMatchIndex > 0 ? currentMatchIndex - 1 : matchedMessages.length - 1;
    }

    setCurrentMatchIndex(newIndex);
    
    if (onMessageFound) {
      onMessageFound(matchedMessages[newIndex], newIndex, matchedMessages.length);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        navigateToMatch('prev');
      } else {
        navigateToMatch('next');
      }
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  const handleClose = () => {
    setSearchTerm('');
    setMatchedMessages([]);
    setCurrentMatchIndex(0);
    if (onClose) onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="message-search-container">
      <div className="search-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Search messages..."
            className="search-input"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="clear-button"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="search-controls">
          {matchedMessages.length > 0 && (
            <div className="match-counter">
              {currentMatchIndex + 1} of {matchedMessages.length}
            </div>
          )}
          
          <button
            onClick={() => navigateToMatch('prev')}
            disabled={matchedMessages.length === 0}
            className="nav-button"
            title="Previous match (Shift + Enter)"
          >
            <ChevronUp size={16} />
          </button>
          
          <button
            onClick={() => navigateToMatch('next')}
            disabled={matchedMessages.length === 0}
            className="nav-button"
            title="Next match (Enter)"
          >
            <ChevronDown size={16} />
          </button>
          
          <button
            onClick={handleClose}
            className="close-button"
            title="Close search (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {searchTerm && matchedMessages.length === 0 && !isSearching && (
        <div className="no-results">
          No messages found for "{searchTerm}"
        </div>
      )}

      {isSearching && (
        <div className="searching-indicator">
          Searching...
        </div>
      )}
    </div>
  );
};

export default MessageSearch;