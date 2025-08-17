import React, { useState, useEffect, useRef } from 'react';

const SearchMessages = ({ messages, currentUsername, selectedUser, onSearchResult, onResultChange }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(-1);
    const [isSearching, setIsSearching] = useState(false);
    const [searchAllConversations, setSearchAllConversations] = useState(false);
    const searchInputRef = useRef(null);

    // Filter messages based on search scope
    const getSearchableMessages = () => {
        if (searchAllConversations) {
            // Search across all conversations
            return messages.filter(m => 
                m.sender === currentUsername || m.recipient === currentUsername
            );
        } else {
            // Search only in current conversation
            return messages.filter(
                m =>
                    (m.sender === currentUsername && m.recipient === selectedUser) ||
                    (m.sender === selectedUser && m.recipient === currentUsername)
            );
        }
    };

    const searchableMessages = getSearchableMessages();

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl+F to focus search
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                    searchInputRef.current.select();
                }
            }
            
            // Escape to clear search
            if (e.key === 'Escape' && searchQuery) {
                clearSearch();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [searchQuery]);

    // Search through messages
    const performSearch = () => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setCurrentResultIndex(-1);
            return;
        }

        setIsSearching(true);
        const query = searchQuery.toLowerCase();
        const results = [];

        searchableMessages.forEach((message, messageIndex) => {
            const text = message.decrypted.toLowerCase();
            let startIndex = 0;
            
            while (true) {
                const index = text.indexOf(query, startIndex);
                if (index === -1) break;
                
                // Get conversation info for display
                const conversationPartner = message.sender === currentUsername ? message.recipient : message.sender;
                
                results.push({
                    messageIndex,
                    messageId: message.id || messageIndex,
                    startIndex: index,
                    endIndex: index + query.length,
                    sender: message.sender,
                    recipient: message.recipient,
                    timestamp: message.timestamp,
                    fullText: message.decrypted,
                    conversationPartner,
                    isCurrentConversation: searchAllConversations ? 
                        (message.sender === selectedUser || message.recipient === selectedUser) : true
                });
                
                startIndex = index + 1;
            }
        });

        setSearchResults(results);
        setCurrentResultIndex(results.length > 0 ? 0 : -1);
        setIsSearching(false);

        // Notify parent component about search results
        if (onSearchResult) {
            onSearchResult(results);
        }
    };

    // Navigate to next result
    const goToNextResult = () => {
        if (searchResults.length === 0) return;
        const newIndex = currentResultIndex < searchResults.length - 1 ? currentResultIndex + 1 : 0;
        setCurrentResultIndex(newIndex);
        if (onResultChange) onResultChange(newIndex);
    };

    // Navigate to previous result
    const goToPrevResult = () => {
        if (searchResults.length === 0) return;
        const newIndex = currentResultIndex > 0 ? currentResultIndex - 1 : searchResults.length - 1;
        setCurrentResultIndex(newIndex);
        if (onResultChange) onResultChange(newIndex);
    };

    // Handle Enter key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                goToPrevResult();
            } else {
                goToNextResult();
            }
        }
    };

    // Clear search
    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setCurrentResultIndex(-1);
        if (onSearchResult) {
            onSearchResult([]);
        }
    };

    // Auto-search when query changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchQuery.trim()) {
                performSearch();
            } else {
                setSearchResults([]);
                setCurrentResultIndex(-1);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery, filteredMessages]);

    // Reset search when conversation changes
    useEffect(() => {
        clearSearch();
    }, [selectedUser]);

    if (!selectedUser) {
        return null;
    }

    return (
        <div style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '15px',
            backgroundColor: '#f8f9fa'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '10px'
            }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <input
                        type="text"
                        placeholder="Search in conversation... (Ctrl+F)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        ref={searchInputRef}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #ccc',
                            borderRadius: '6px',
                            fontSize: '14px',
                            outline: 'none'
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={clearSearch}
                            style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                fontSize: '16px',
                                cursor: 'pointer',
                                color: '#666'
                            }}
                        >
                            ×
                        </button>
                    )}
                </div>
                
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '12px',
                    color: '#666',
                    cursor: 'pointer'
                }}>
                    <input
                        type="checkbox"
                        checked={searchAllConversations}
                        onChange={(e) => setSearchAllConversations(e.target.checked)}
                        style={{ margin: 0 }}
                    />
                    All conversations
                </label>
                
                {searchResults.length > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '12px',
                        color: '#666'
                    }}>
                        <button
                            onClick={goToPrevResult}
                            style={{
                                background: 'none',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            ↑
                        </button>
                        <span>
                            {currentResultIndex + 1} of {searchResults.length}
                        </span>
                        <button
                            onClick={goToNextResult}
                            style={{
                                background: 'none',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '12px'
                            }}
                        >
                            ↓
                        </button>
                    </div>
                )}
            </div>

            {searchResults.length > 0 && (
                <div style={{
                    fontSize: '12px',
                    color: '#666',
                    borderTop: '1px solid #eee',
                    paddingTop: '10px'
                }}>
                    <div style={{ marginBottom: '5px' }}>
                        <strong>Search Results:</strong>
                    </div>
                    {searchResults.map((result, index) => (
                        <div
                            key={index}
                            style={{
                                padding: '5px',
                                margin: '2px 0',
                                borderRadius: '4px',
                                backgroundColor: index === currentResultIndex ? '#e3f2fd' : 'transparent',
                                cursor: 'pointer',
                                fontSize: '11px'
                            }}
                            onClick={() => {
                                setCurrentResultIndex(index);
                                if (onResultChange) onResultChange(index);
                            }}
                        >
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginBottom: '2px'
                            }}>
                                <span style={{ fontWeight: 'bold', color: '#333' }}>
                                    {result.sender === currentUsername ? 'You' : result.sender}
                                </span>
                                {searchAllConversations && (
                                    <span style={{ 
                                        fontSize: '10px', 
                                        color: result.isCurrentConversation ? '#4caf50' : '#ff9800',
                                        backgroundColor: result.isCurrentConversation ? '#e8f5e8' : '#fff3e0',
                                        padding: '1px 4px',
                                        borderRadius: '8px'
                                    }}>
                                        {result.isCurrentConversation ? 'Current' : result.conversationPartner}
                                    </span>
                                )}
                            </div>
                            <div style={{ 
                                color: '#666',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '200px'
                            }}>
                                {result.fullText.substring(0, result.startIndex)}
                                <span style={{ 
                                    backgroundColor: '#ffeb3b',
                                    fontWeight: 'bold'
                                }}>
                                    {result.fullText.substring(result.startIndex, result.endIndex)}
                                </span>
                                {result.fullText.substring(result.endIndex)}
                            </div>
                            <div style={{ color: '#999', fontSize: '10px' }}>
                                {new Date(result.timestamp).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isSearching && (
                <div style={{
                    textAlign: 'center',
                    color: '#666',
                    fontSize: '12px',
                    fontStyle: 'italic'
                }}>
                    Searching...
                </div>
            )}

            {searchQuery && searchResults.length === 0 && !isSearching && (
                <div style={{
                    textAlign: 'center',
                    color: '#666',
                    fontSize: '12px',
                    fontStyle: 'italic'
                }}>
                    No results found for "{searchQuery}"
                </div>
            )}

            {searchResults.length === 0 && !searchQuery && (
                <div style={{
                    fontSize: '11px',
                    color: '#999',
                    textAlign: 'center',
                    marginTop: '5px'
                }}>
                    <strong>Keyboard shortcuts:</strong> Ctrl+F to focus, Enter/Shift+Enter to navigate, Esc to clear
                </div>
            )}
        </div>
    );
};

export default SearchMessages;
