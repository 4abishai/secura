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
