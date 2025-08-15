// SecureChatApp.jsx - Enhanced Version with Search Integration
import React, { useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useWebSocket } from './hooks/useWebSocket';

import Registration from './components/Registration';
import UserList from './components/UserList';
import MessageInput from './components/MessageInput';
import MessageList from './components/MessageList'; // This will be your enhanced version
import './search-styles.css'; // Import the search styles

const SecureChatApp = () => {
  // ... (keep all your existing hook implementations unchanged)
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

  const {
    connectionStatus,
    setConnectionStatus,
    setupWebSocketHandlers,
    disconnect
  } = useWebSocket(username);

  // ... (keep all your existing functions unchanged)
  const onRegisterUser = async () => {
    try {
      setConnectionStatus('connecting');
      const result = await handleRegisterUser();
      if (result.success) {
        await handleFetchUsers(username, updateUserInMap);
      }
    } catch (error) {
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
      console.log('Initializing app for:', storedUsername);
      setConnectionStatus('connecting');
      const result = await initializeAuth(storedUsername);
      if (result.success) {
        await handleFetchUsers(storedUsername, updateUserInMap);
        console.log('App initialization complete');
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
      setConnectionStatus('disconnected');
    }
  };

  // ... (keep all your existing useEffect hooks unchanged)
  useEffect(() => {
    console.log('Setting up WebSocket handlers');
    const cleanup = setupWebSocketHandlers(
      (data) => handleDecryptAndAddMessage(data, handleDecryptMessage, privateKeyRef),
      (messageList) => handleDecryptMessages(messageList, handleDecryptMessage),
      updateUserPresence
    );
    
    return cleanup;
  }, [setupWebSocketHandlers, handleDecryptAndAddMessage, handleDecryptMessages, handleDecryptMessage, privateKeyRef, updateUserPresence]);

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      console.log('Found stored username:', storedUsername);
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

  useEffect(() => {
    if (connectionStatus === 'connected' && username && privateKey) {
      console.log('Connection ready - IndexedDB storage active');
    }
  }, [connectionStatus, username, selectedUser, privateKey]);

  if (!username) {
  return (
    <Registration
      inputUsername={inputUsername}
      onUsernameChange={setInputUsername}
      inputPassword={inputPassword}
      onPasswordChange={setInputPassword}
      onRegister={onRegisterUser}
      isLogin={isLogin}
      onToggleMode={() => setIsLogin(prev => !prev)}
    />
  );
}


  return (
    <div className="secure-chat-app">
      {keyChangeNotifications.length > 0 && (
        <div className="key-notifications">
          {keyChangeNotifications.map(notification => (
            <div key={notification.id} className="notification">
              <div className="notification-content">
                <strong>🔑 Security Key Updated</strong>
                <p>{notification.message}</p>
              </div>
              <button onClick={() => dismissKeyNotification(notification.id)}>
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="app-header">
        <div className="header-content">
          <h1>Welcome, {username}</h1>
          <div className="status-indicators">
            <span className={`connection-status ${connectionStatus}`}>
              ● {connectionStatus.toUpperCase()}
            </span>
            <span className="key-status">
              🔑 {privateKey ? 'KEY OK' : 'NO KEY'}
            </span>
            <button onClick={onLogout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="chat-container">
        <div className="sidebar">
          <UserList 
            users={users}
            onUserSelect={setSelectedUser}
            selectedUser={selectedUser}
            onFetchUsers={onFetchUsers}
          />
        </div>

        <div className="chat-area">
          {/* Enhanced MessageList with search functionality */}
          <MessageList 
            messages={messages}
            currentUsername={username}
            selectedUser={selectedUser}
          />
          
          <MessageInput
            selectedUser={selectedUser}
            message={message}
            onMessageChange={setMessage}
            onSendMessage={onSendMessage}
          />
        </div>
      </div>
    </div>
  );
};

export default SecureChatApp;