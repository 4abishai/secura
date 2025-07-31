import React from 'react';

const MessageInput = ({ selectedUser, message, onMessageChange, onSendMessage }) => {
  if (!selectedUser) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <h3>Chat with {selectedUser}</h3>
      <textarea
        rows="3"
        value={message}
        onChange={e => onMessageChange(e.target.value)}
        placeholder="Type your message"
        style={{ width: '100%', padding: 8, marginBottom: 10 }}
        onKeyPress={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSendMessage())}
      />
      <button 
        onClick={onSendMessage}
        style={{ padding: 8, width: '100%' }}
        disabled={!message.trim()}
      >
        Send
      </button>
    </div>
  );
};

export default MessageInput;