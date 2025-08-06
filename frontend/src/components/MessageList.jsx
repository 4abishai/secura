const MessageList = ({ messages, currentUsername, selectedUser }) => {
    const filteredMessages = messages.filter(
        m =>
            (m.sender === currentUsername && m.recipient === selectedUser) ||
            (m.sender === selectedUser && m.recipient === currentUsername)
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>Messages</h3>
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
                {!selectedUser ? (
                    <p style={{ color: '#666' }}>Select a user to start chatting</p>
                ) : filteredMessages.length === 0 ? (
                    <p style={{ color: '#666' }}>No conversation yet with {selectedUser}</p>
                ) : (
                    filteredMessages.map((m, i) => (
                        <div
                            key={i}
                            style={{
                                alignSelf: m.sender === currentUsername ? 'flex-end' : 'flex-start',
                                backgroundColor: m.sender === currentUsername ? '#dcf8c6' : '#ffffff',
                                padding: 10,
                                borderRadius: 8,
                                maxWidth: '75%',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#555', marginBottom: 4, width: '100%', gap: 10, whiteSpace: 'nowrap' }}>
                                {m.sender === currentUsername ? 'You' : m.sender}
                                <span style={{ float: 'right' }}>
                                    {new Date(m.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                            <div>{m.decrypted}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
export default MessageList;
