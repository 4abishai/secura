import React, { useEffect, useState } from 'react';
import './SecureChatApp.css';

import { useAuth } from './hooks/useAuth';
import { useChat } from './hooks/useChat';
import { useWebSocket } from './hooks/useWebSocket';

import Registration from './components/Registration';
import UserList from './components/UserList';
import MessageInput from './components/MessageInput';
import MessageList from './components/MessageList';
import { callAI, websocketService } from './services/api';

const SecureChatApp = () => {
  // Auth hook - handles authentication, keys, and encryption
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

  // Chat hook - handles messages and users
  const {
    messages,
    message,
    setMessages,
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

  // WebSocket hook - handles connection and presence
  const {
    connectionStatus,
    setConnectionStatus,
    setupWebSocketHandlers,
    disconnect
  } = useWebSocket(username);

  // AI processing state
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Sidebar state
  const [activeTab, setActiveTab] = useState("Chats");
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

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
    if (!message.trim() || !selectedUser) return;

    const aiMentionMatch = message.match(/@AI\s+(.+)/i);

    if (aiMentionMatch) {
      setIsProcessingAI(true);
      try {
        const aiQuery = aiMentionMatch[1].trim();
        const aiResponse = await callAI(aiQuery);
        const aiMessageText = `🤖 AI Response: ${aiResponse}`;
        await handleSendMessage(encryptMessage, usernameRef, privateKeyRef, aiMessageText);
      } catch (error) {
        console.error('Error processing @AI mention:', error);
      } finally {
        setIsProcessingAI(false);
        setMessage('');
      }
    } else {
      await handleSendMessage(encryptMessage, usernameRef, privateKeyRef);
    }
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
    } catch (error) {
      console.error('Failed to initialize:', error);
      setConnectionStatus('disconnected');
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        console.log("Notification permission:", permission);
      });
    }
  }, []);

  useEffect(() => {
    if (activeTab === "Tasks" && connectionStatus === "connected") {
      try {
        setLoadingTasks(true);
        websocketService.send({ type: "get_pending_tasks" });
      } catch (err) {
        console.error("Failed to request tasks:", err);
      }
    }
  }, [activeTab, connectionStatus]);

  useEffect(() => {
    const cleanup = setupWebSocketHandlers(
      (data) => {
        handleDecryptAndAddMessage(data, handleDecryptMessage, privateKeyRef);
      },
      (messageList) => handleDecryptMessages(messageList, handleDecryptMessage),
      updateUserPresence,
      handleDecryptMessage,
      privateKeyRef,
      (tasksData) => {
        setTasks(tasksData || []);
        setLoadingTasks(false);
      },
      (notification) => showNotification('custom', notification),
      (deadlineInfo) => showNotification('deadline', deadlineInfo)
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

  useEffect(() => {
    if (connectionStatus === 'connected' && username && privateKey) {
      console.log('Connection ready - IndexedDB storage active');
    }
  }, [connectionStatus, username, selectedUser, privateKey]);

  const showNotification = (type, message) => {
    switch (type) {
      case 'deadline':
        if (Notification.permission === 'granted') {
          new Notification('Task Deadline Alert', {
            body: `${message.taskTitle} — ${message.message}`,
          });
        }
        break;
      case 'custom':
        if (Notification.permission === 'granted') {
          new Notification('Notification', {
            body: message.message,
          });
        }
        break;
      default:
        console.log("INFO:", message);
    }
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

  const statusClass =
    connectionStatus === 'connected'
      ? 'status-dot status-dot--connected'
      : connectionStatus === 'connecting'
      ? 'status-dot status-dot--connecting'
      : 'status-dot status-dot--disconnected';

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <h3 className="sidebar__title">Menu</h3>
        <button
          className={`tab ${activeTab === "Chats" ? 'tab--active' : ''}`}
          onClick={() => setActiveTab("Chats")}
        >
          💬 Chats
        </button>
        <button
          className={`tab ${activeTab === "Tasks" ? 'tab--active' : ''}`}
          onClick={() => setActiveTab("Tasks")}
        >
          ✅ Tasks
        </button>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Key-change alerts */}
        {keyChangeNotifications.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            {keyChangeNotifications.map(notification => (
              <div className="alert" key={notification.id}>
                <div>
                  <div className="alert__title">🔑 Security Key Updated</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {notification.message}
                  </div>
                </div>
                <button
                  className="alert__dismiss"
                  onClick={() => dismissKeyNotification(notification.id)}
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="header">
          <h2>Welcome, {username}</h2>
          <div className="header__meta">
            {isProcessingAI && (
              <span className="pill pill--warn">🤖 Processing AI…</span>
            )}
            <span className={`pill ${statusClass}`}>
              ● {connectionStatus.toUpperCase()}
            </span>
            <span className={`pill ${privateKey ? 'pill--ok' : 'pill--error'}`}>
              🔑 {privateKey ? 'KEY OK' : 'NO KEY'}
            </span>
            <button className="btn" onClick={onLogout}>Logout</button>
          </div>
        </div>

        {/* AI Tip */}
        <div className="tip">
          💡 <strong>Tip:</strong> Type <span className="code">@AI your question</span> in any chat to get AI assistance that both users can see
        </div>

        {/* Content */}
        {activeTab === "Chats" && (
          <div className="grid">
            <section className="panel">
              <div className="panel__section">
                <UserList
                  users={users}
                  selectedUser={selectedUser}
                  onUserSelect={setSelectedUser}
                  onRefresh={onFetchUsers}
                />
              </div>
              <div className="panel__section">
                <MessageInput
                  selectedUser={selectedUser}
                  message={message}
                  onMessageChange={setMessage}
                  onSendMessage={onSendMessage}
                  disabled={connectionStatus !== 'connected' || !privateKey || isProcessingAI}
                />
              </div>
            </section>

            <section className="panel">
              <div className="panel__section">
                <MessageList
                  messages={messages}
                  currentUsername={username}
                  selectedUser={selectedUser}
                />
              </div>
            </section>
          </div>
        )}

        {activeTab === "Tasks" && (
          <section className="tasks">
            <h3>✅ Your Tasks</h3>
            {loadingTasks ? (
              <p style={{ color: 'var(--muted)' }}>Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No pending tasks</p>
            ) : (
              <ul className="tasklist">
                {tasks.map((task, idx) => (
                  <li key={idx} className="task">
                    <strong>{task.taskTitle}</strong>
                    <div className="meta">
                      Assigned by: <b>{task.assignedBy}</b> · Due:{" "}
                      <b>{new Date(task.deadline).toLocaleString()}</b>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default SecureChatApp;
