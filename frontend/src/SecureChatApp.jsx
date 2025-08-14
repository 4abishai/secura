import React, { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useWebSocket } from './hooks/useWebSocket';

import Registration from './components/Registration';
import UserList from './components/UserList';
import MessageInput from './components/MessageInput';
import MessageList from './components/MessageList';
import SpeechRecorder from './components/SpeechRecorder.jsx';

const SecureChatApp = () => {
  // Auth hook
  const {
    username,
    setUsername,
    inputUsername,
    setInputUsername,
    inputPassword,
    setInputPassword,
    privateKey,
    publicKeyBase64,
    isLogin,
    setIsLogin,
    userMap,
    keyChangeNotifications,
    privateKeyRef,
    usernameRef,
    handleRegisterUser,
    logout,
    initializeAuth,
    handleDecryptMessage,
    encryptMessage,
    updateUserInMap,
    dismissKeyNotification
  } = useAuth();

  // Chat hook
  const {
    messages,
    message,
    setMessage,
    selectedUser,
    setSelectedUser,
    users,
    handleDecryptMessages,
    handleDecryptAndAddMessage,
    handleSendMessage,
    handleFetchUsers,
    updateUserPresence,
    clearMessages,
    clearUsers,
    loadMessagesFromStorage
  } = useChat();

  // WebSocket hook
  const {
    connectionStatus,
    setConnectionStatus,
    setupWebSocketHandlers,
    disconnect
  } = useWebSocket(username);

  // Recorder toggle state
  const [showRecorder, setShowRecorder] = useState(false);

  const onRegisterUser = async () => {
    try {
      setConnectionStatus('connecting');
      const result = await handleRegisterUser();
      if (result.success) {
        await handleFetchUsers(username, updateUserInMap);
      }
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  const onSendMessage = async () => {
    await handleSendMessage(encryptMessage, usernameRef, privateKeyRef);
  };

  const onFetchUsers = async () => {
    await handleFetchUsers(username, updateUserInMap);
  };

  const onLogout = async () => {
    logout();
    disconnect();
    await clearMessages();
    clearUsers();
    setSelectedUser(null);
  };

  const initializeApp = async (storedUsername) => {
    try {
      setConnectionStatus('connecting');
      const result = await initializeAuth(storedUsername);
      if (result.success) {
        await handleFetchUsers(storedUsername, updateUserInMap);
      }
    } catch {
      setConnectionStatus('disconnected');
    }
  };

  // Setup WebSocket handlers
  useEffect(() => {
    const cleanup = setupWebSocketHandlers(
      (data) => handleDecryptAndAddMessage(data, handleDecryptMessage, privateKeyRef),
      (messageList) => handleDecryptMessages(messageList, handleDecryptMessage),
      updateUserPresence
    );
    return cleanup;
  }, [
    setupWebSocketHandlers,
    handleDecryptAndAddMessage,
    handleDecryptMessages,
    handleDecryptMessage,
    privateKeyRef,
    updateUserPresence
  ]);

  // Initial app setup
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
      initializeApp(storedUsername);
    }
    return () => {
      disconnect();
    };
  }, []);

  useEffect(() => {
    if (selectedUser && username) {
      loadMessagesFromStorage(username, selectedUser);
    }
  }, [selectedUser, username, loadMessagesFromStorage]);

  // When speech transcription completes, put it directly into message state
  const handleTranscriptionComplete = (transcribedText) => {
    setMessage(transcribedText);
    setShowRecorder(false); // optional: auto-close after recording
  };

  if (!username) {
    return (
      <Registration
        inputUsername={inputUsername}
        inputPassword={inputPassword}
        onUsernameChange={setInputUsername}
        onPasswordChange={setInputPassword}
        onRegister={onRegisterUser}
        isLogin={isLogin}
        onToggleMode={() => setIsLogin(!isLogin)}
      />
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial', maxWidth: 800 }}>
      {/* Key change notifications */}
      {keyChangeNotifications.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {keyChangeNotifications.map(notification => (
            <div
              key={notification.id}
              style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: 4,
                padding: 10,
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <strong>🔑 Security Key Updated</strong>
                <div style={{ fontSize: '14px', marginTop: 5 }}>
                  {notification.message}
                </div>
              </div>
              <button
                onClick={() => dismissKeyNotification(notification.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Welcome, {username}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              color:
                connectionStatus === 'connected' ? 'green' :
                connectionStatus === 'connecting' ? 'orange' : 'red',
              fontSize: '12px'
            }}
          >
            ● {connectionStatus.toUpperCase()}
          </span>
          <span style={{ fontSize: '12px', color: privateKey ? 'green' : 'red' }}>
            🔑 {privateKey ? 'KEY OK' : 'NO KEY'}
          </span>
          <button onClick={onLogout}>Logout</button>
          <button onClick={() => setShowRecorder(prev => !prev)}>
            {showRecorder ? 'Close Speech' : '🎤 Speech to Text'}
          </button>
        </div>
      </div>

      {/* Speech recorder */}
      {showRecorder && (
        <div style={{ marginBottom: 20 }}>
          <SpeechRecorder onTranscriptionComplete={handleTranscriptionComplete} />
        </div>
      )}

      {/* Chat layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        <div>
          <UserList
            users={users}
            selectedUser={selectedUser}
            onUserSelect={setSelectedUser}
            onRefresh={onFetchUsers}
          />
          <MessageInput
            selectedUser={selectedUser}
            message={message}
            onMessageChange={setMessage}
            onSendMessage={onSendMessage}
            disabled={connectionStatus !== 'connected' || !privateKey}
          />
        </div>
        <MessageList
          messages={messages}
          currentUsername={username}
          selectedUser={selectedUser}
        />
      </div>
    </div>
  );
};

export default SecureChatApp;
