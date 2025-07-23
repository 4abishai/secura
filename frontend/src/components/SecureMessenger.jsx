// src/components/SecureMessenger.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  buildSessionWithRecipient,
  encryptMessage,
  decryptMessage
} from '../crypto/sessionUtils';
import { mockServer } from '../mock/mockServer';
import * as libsignal from '@privacyresearch/libsignal-protocol-typescript';

const SecureMessenger = ({ currentUser, contact, onBack }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sessionEstablished, setSessionEstablished] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const sessionRef = useRef(null);

  const getChatId = (user1, user2) => {
    return [user1, user2].sort().join('_');
  };

  const saveMessages = (updatedMessages) => {
    if (!currentUser || !contact) return;
    const chatId = getChatId(currentUser.id, contact.id);
    setMessages(updatedMessages);
    localStorage.setItem(`messages_${chatId}`, JSON.stringify(updatedMessages));
  };

  useEffect(() => {
    if (!currentUser || !contact) return;

    const chatId = getChatId(currentUser.id, contact.id);
    const savedMessages = localStorage.getItem(`messages_${chatId}`);
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    }
  }, [currentUser?.id, contact?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!currentUser || !contact) return;
    establishSession();
  }, [currentUser?.id, contact?.id]);

  useEffect(() => {
  const interval = setInterval(fetchIncomingMessages, 2000);
  return () => clearInterval(interval);
}, [currentUser?.id, contact?.id]);

const fetchIncomingMessages = async () => {
  try {
    const allMessages = mockServer.getMessages(currentUser.id, contact.id);
    const unseenMessages = allMessages.filter(m => m.recipientId === currentUser.id);
    const currentChatId = getChatId(currentUser.id, contact.id);

    const decrypted = [];
    const userStore = mockServer.getUserStore(currentUser.id);

    for (const msg of unseenMessages) {
      const senderAddr = new libsignal.SignalProtocolAddress(msg.senderId, 1);
      const ciphertext = JSON.parse(msg.encryptedMessage);
      const decryptedBuf = await decryptMessage(userStore, senderAddr, ciphertext);
      const text = new TextDecoder().decode(decryptedBuf);

      decrypted.push({
        ...msg,
        content: text,
        type: 'received'
      });
    }

    if (decrypted.length > 0) {
      const updated = [...messages, ...decrypted];
      setMessages(updated);
      localStorage.setItem(`messages_${currentChatId}`, JSON.stringify(updated));
    }
  } catch (err) {
    console.error('Error fetching incoming messages:', err);
  }
};


  const establishSession = async () => {
    try {
      const contactBundle = mockServer.getUserBundle(contact.id);
      const currentUserStore = mockServer.getUserStore(currentUser.id);

      const address = await buildSessionWithRecipient(
        contact.id,
        contactBundle,
        currentUserStore
      );

      sessionRef.current = address;
      setSessionEstablished(true);
      setError('');
    } catch (err) {
      setError('Failed to establish secure session');
      console.error('Session establishment error:', err);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !sessionEstablished || isSending) {
      return;
    }

    setIsSending(true);
    setError('');

    try {
      const currentUserStore = mockServer.getUserStore(currentUser.id);

      const ciphertext = await encryptMessage(
        currentUserStore,
        sessionRef.current,
        newMessage
      );

      const message = {
        id: Date.now().toString(),
        senderId: currentUser.id,
        recipientId: contact.id,
        content: newMessage,
        encrypted: JSON.stringify(ciphertext),
        timestamp: new Date().toISOString(),
        type: 'sent'
      };

      const updatedMessages = [...messages, message];
      saveMessages(updatedMessages);


      setNewMessage('');
    } catch (err) {
      setError('Failed to send message');
      console.error('Send message error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!currentUser || !contact) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-[600px]">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back
          </button>
          <div>
            <h2 className="font-semibold">{contact.name}</h2>
            <p className="text-sm text-gray-600">{contact.phoneNumber}</p>
          </div>
        </div>

        <div className="text-sm">
          {sessionEstablished ? (
            <span className="text-green-600">Secure</span>
          ) : (
            <span className="text-yellow-600">Connecting...</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {!sessionEstablished && (
          <div className="bg-yellow-50 text-yellow-700 p-3 rounded-md text-sm">
            Establishing secure connection...
          </div>
        )}

        {messages.length === 0 && sessionEstablished && (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet.</p>
            <p className="text-sm">Send your first encrypted message!</p>
          </div>
        )}

        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                message.senderId === currentUser.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <p className="break-words">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.senderId === currentUser.id ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {formatTime(message.timestamp)}
              </p>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="1"
            disabled={!sessionEstablished || isSending}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !sessionEstablished || isSending}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? '...' : 'Send'}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Messages are encrypted with Signal protocol end-to-end encryption
        </p>
      </div>
    </div>
  );
};

export default SecureMessenger;
