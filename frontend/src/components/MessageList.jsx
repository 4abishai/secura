import React from 'react';

const MessageList = ({ messages, currentUsername, onRefresh }) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Messages</h3>
        <button 
          onClick={onRefresh} 
          style={{ padding: 6, fontSize: 12 }}
          title="Refresh messages"
        >
          🔄 Refresh
        </button>
      </div>
      <div style={{ 
        border: '1px solid #ccc', 
        padding: 10, 
        borderRadius: 4, 
        height: 400, 
        overflowY: 'auto',
        backgroundColor: '#f9f9f9'
      }}>
        {messages.length === 0 ? (
          <p style={{ color: '#666' }}>No messages yet</p>
        ) : (
          messages.map((m, i) => (
            <div 
              key={i} 
              style={{ 
                marginBottom: 10, 
                padding: 8, 
                backgroundColor: m.sender === currentUsername ? '#e8f5e8' : 'white',
                borderRadius: 4,
                marginLeft: m.sender === currentUsername ? 20 : 0,
                marginRight: m.sender === currentUsername ? 0 : 20
              }}
            >
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                <strong>{m.sender}</strong> → {m.recipient} 
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