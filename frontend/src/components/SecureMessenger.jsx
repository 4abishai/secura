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
  const [lastFetchedMessageId, setLastFetchedMessageId] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
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
      const parsed = JSON.parse(savedMessages);
      setMessages(parsed);
      if (parsed.length > 0) {
        // Get the highest ID from saved messages
        const maxId = Math.max(...parsed.map(m => parseInt(m.id)));
        setLastFetchedMessageId(maxId.toString());
      }
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
    if (!sessionEstablished) return;
    
    console.log('Starting message polling for user:', currentUser.id);
    const interval = setInterval(fetchIncomingMessages, 2000);
    return () => {
      console.log('Stopping message polling for user:', currentUser.id);
      clearInterval(interval);
    };
  }, [currentUser?.id, contact?.id, sessionEstablished, lastFetchedMessageId]);

  const fetchIncomingMessages = async () => {
    try {
      
      const allMessages = mockServer.getMessages(currentUser.id, contact.id);
      
      // Filter for messages where current user is the recipient AND we haven't processed them yet
      const newIncomingMessages = allMessages.filter(m => {
        const isForMe = m.recipientId === currentUser.id;
        // Convert to numbers for proper comparison
        const messageIdNum = parseInt(m.id);
        const lastFetchedNum = lastFetchedMessageId ? parseInt(lastFetchedMessageId) : 0;
        const isNew = messageIdNum > lastFetchedNum;
        console.log(`Message ${m.id}: isForMe=${isForMe}, isNew=${isNew}, messageIdNum=${messageIdNum}, lastFetchedNum=${lastFetchedNum}`);
        return isForMe && isNew;
      });

      setDebugInfo(`Last check: ${new Date().toLocaleTimeString()} - Found ${newIncomingMessages.length} new messages`);

      if (newIncomingMessages.length === 0) return;

      const currentChatId = getChatId(currentUser.id, contact.id);
      const decrypted = [];
      const userStore = mockServer.getUserStore(currentUser.id);

      for (const msg of newIncomingMessages) {
        try {
          console.log(`[${currentUser.id}] Decrypting message ${msg.id} from ${msg.senderId}`);
          
          const senderAddr = new libsignal.SignalProtocolAddress(msg.senderId, 1);
          const ciphertext = JSON.parse(msg.encryptedMessage);
          const decryptedBuf = await decryptMessage(userStore, senderAddr, ciphertext);
          const text = new TextDecoder().decode(decryptedBuf);
          
          console.log(`[${currentUser.id}] Successfully decrypted: "${text}"`);
          
          decrypted.push({
            id: msg.id,
            senderId: msg.senderId,
            recipientId: msg.recipientId,
            content: text,
            timestamp: msg.timestamp,
            type: 'received'
          });
        } catch (decryptError) {
          console.error(`[${currentUser.id}] Error decrypting message ${msg.id}:`, decryptError);
        }
      }

      if (decrypted.length > 0) {
        console.log(`[${currentUser.id}] Adding ${decrypted.length} decrypted messages to UI`);
        
        setMessages(prev => {
          const updated = [...prev, ...decrypted];
          localStorage.setItem(`messages_${currentChatId}`, JSON.stringify(updated));
          console.log(`[${currentUser.id}] Updated messages array:`, updated);
          return updated;
        });
        
        // Update the last fetched message ID
        const newLastId = parseInt(decrypted[decrypted.length - 1].id);
        setLastFetchedMessageId(newLastId.toString());
        console.log(`[${currentUser.id}] Updated lastFetchedMessageId to:`, newLastId);
      }
    } catch (err) {
      console.error(`[${currentUser.id}] Error fetching incoming messages:`, err);
      setDebugInfo(`Error: ${err.message}`);
    }
  };

  const establishSession = async () => {
    try {
      console.log(`[${currentUser.id}] Establishing session with ${contact.id}`);
      
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
      
      console.log(`[${currentUser.id}] Session established successfully`);
    } catch (err) {
      setError('Failed to establish secure session');
      console.error(`[${currentUser.id}] Session establishment error:`, err);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !sessionEstablished || isSending) {
      return;
    }

    setIsSending(true);
    setError('');

    try {
      console.log(`[${currentUser.id}] Sending message to ${contact.id}: "${newMessage}"`);
      
      const currentUserStore = mockServer.getUserStore(currentUser.id);
      const ciphertext = await encryptMessage(
        currentUserStore,
        sessionRef.current,
        newMessage
      );

      // Store the encrypted message on the server so the recipient can fetch it
      const serverMessage = mockServer.storeMessage(
        currentUser.id,
        contact.id,
        JSON.stringify(ciphertext)
      );
      
      console.log(`[${currentUser.id}] Message stored on server with ID:`, serverMessage.id);

      // Create the local message for immediate display
      const localMessage = {
        id: serverMessage.id,
        senderId: currentUser.id,
        recipientId: contact.id,
        content: newMessage,
        timestamp: serverMessage.timestamp,
        type: 'sent'
      };

      const updatedMessages = [...messages, localMessage];
      saveMessages(updatedMessages);
      
      // Update last fetched message ID to include our own sent message
      setLastFetchedMessageId(serverMessage.id);
      
      setNewMessage('');
      console.log(`[${currentUser.id}] Message sent successfully`);
      
      // Debug: Check what's in the server after sending
      const allMessagesAfterSend = mockServer.getMessages(currentUser.id, contact.id);
      console.log(`[${currentUser.id}] All messages in server after send:`, allMessagesAfterSend);
      
    } catch (err) {
      setError('Failed to send message');
      console.error(`[${currentUser.id}] Send message error:`, err);
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

      {/* Debug Info Panel */}
      <div className="bg-gray-100 p-2 text-xs text-gray-600 border-b">
        <div>User: {currentUser.id} | Contact: {contact.id} | Session: {sessionEstablished ? 'Yes' : 'No'}</div>
        <div>Last Fetched ID: {lastFetchedMessageId || 'None'}</div>
        <div>{debugInfo}</div>
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
                {formatTime(message.timestamp)} - ID: {message.id}
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