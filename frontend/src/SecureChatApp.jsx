import React, { useEffect, useState } from 'react';
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
    } catch (error) {
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

      // Optionally send the original @AI message
      // await handleSendMessage(encryptMessage, usernameRef, privateKeyRef);

      // Call AI
      // const aiResponse = await callAIService(aiQuery);
      const aiResponse = await callAI(aiQuery);
      console.log('AI Response:', aiResponse);

      // Send AI response as a normal chat message (without touching input box)
      const aiMessageText = `🤖 AI Response: ${aiResponse}`;
      await handleSendMessage(encryptMessage, usernameRef, privateKeyRef, aiMessageText);

    } catch (error) {
      console.error('Error processing @AI mention:', error);
    } finally {
      setIsProcessingAI(false);
      setMessage(''); // clear input box
    }
  } else {
    // Normal user message
    await handleSendMessage(encryptMessage, usernameRef, privateKeyRef);
  }
};


  const onFetchUsers = async () => {
    await handleFetchUsers(username, updateUserInMap);
  };

  // Update the logout function:
  const onLogout = async () => {
    logout();
    disconnect();
    await clearMessages(); // This now clears IndexedDB
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

  // Ask server for pending tasks when Tasks tab is opened
  useEffect(() => {
    if (activeTab === "Tasks" && connectionStatus === "connected") {
      try {
        setLoadingTasks(true);   // show loading state until tasks arrive
        websocketService.send({ type: "get_pending_tasks" });
      } catch (err) {
        console.error("Failed to request tasks:", err);
      }
    }
  }, [activeTab, connectionStatus]);

  // Setup WebSocket handlers once on mount
  useEffect(() => {
    console.log('Setting up WebSocket handlers');
      const cleanup = setupWebSocketHandlers(
          (data) => {
              handleDecryptAndAddMessage(data, handleDecryptMessage, privateKeyRef);
          },
          (messageList) => handleDecryptMessages(messageList, handleDecryptMessage),
          updateUserPresence,
          handleDecryptMessage,
          privateKeyRef,
          (tasksData) => {
              console.log("Pending tasks received:", tasksData);
              setTasks(tasksData || []);
              setLoadingTasks(false);
          }
      );


      return cleanup;
  }, [setupWebSocketHandlers, handleDecryptAndAddMessage, handleDecryptMessages, handleDecryptMessage, privateKeyRef, updateUserPresence]);

  // Handle initial app setup
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
  }, []); // Run once on mount

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
  <div style={{ display: 'flex', height: '100vh', fontFamily: 'Arial' }}>
    {/* Sidebar */}
    <div style={{
      width: '200px',
      backgroundColor: '#f5f5f5',
      borderRight: '1px solid #ddd',
      display: 'flex',
      flexDirection: 'column',
      padding: '10px'
    }}>
    <h3 style={{ marginBottom: '20px' }}>Menu</h3>
    <button
      onClick={() => setActiveTab("Chats")}
      style={{
        padding: '10px',
        marginBottom: '10px',
        backgroundColor: activeTab === "Chats" ? '#d1e7dd' : '#fff',
        border: '1px solid #ccc',
        cursor: 'pointer',
        textAlign: 'left'
      }}
    >
      💬 Chats
    </button>
    <button
      onClick={() => setActiveTab("Tasks")}
      style={{
        padding: '10px',
        backgroundColor: activeTab === "Tasks" ? '#d1e7dd' : '#fff',
        border: '1px solid #ccc',
        cursor: 'pointer',
        textAlign: 'left'
      }}
    >
      ✅ Tasks
    </button>
    </div>

    <div style={{ flex: 1, padding: 20 }}>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Welcome, {username}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isProcessingAI && (
            <span style={{
              color: 'orange',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}>
              🤖 Processing AI...
            </span>
          )}
          <span
            style={{
              color: connectionStatus === 'connected' ? 'green' :
                     connectionStatus === 'connecting' ? 'orange' : 'red',
              fontSize: '12px'
            }}
          >
            ● {connectionStatus.toUpperCase()}
          </span>
          <span style={{ fontSize: '12px', color: privateKey ? 'green' : 'red' }}>
            🔑 {privateKey ? 'KEY OK' : 'NO KEY'}
          </span>
          <button onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      {/* AI Mention Help */}
      <div style={{
        backgroundColor: '#f0f8ff',
        border: '1px solid #b0d4f1',
        borderRadius: '4px',
        padding: '8px',
        marginBottom: '15px',
        fontSize: '12px',
        color: '#2c5aa0'
      }}>
        💡 <strong>Tip:</strong> Type <code>@AI your question</code> in any chat to get AI assistance that both users can see
      </div>

      {activeTab === "Chats" && (
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
            disabled={connectionStatus !== 'connected' || !privateKey || isProcessingAI}
          />
        </div>
        <MessageList
          messages={messages}
          currentUsername={username}
          selectedUser={selectedUser}
        />
        </div>
      )}

        {activeTab === "Tasks" && (
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ✅ Your Tasks
            </h3>
            {loadingTasks ? (
              <p>Loading tasks...</p>
            ) : tasks.length === 0 ? (
                    <p>No pending tasks</p>
            ) : (
              <ul style={{ listStyleType: 'none', padding: 0 }}>
                {tasks.map((task, idx) => (
                  <li
                    key={idx}
                    style={{
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      padding: '16px',
                      marginBottom: '10px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                      transition: 'transform 0.2s ease-in-out',
                      fontFamily: 'Arial, sans-serif'
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '18px', marginBottom: '8px', color: '#333' }}>
                        {task.taskTitle}
                    </strong>
                    <hr style={{ borderTop: '1px solid #eee', margin: '10px 0' }} />
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      <span style={{ display: 'block', marginBottom: '4px' }}>
                        Assigned by: <span style={{ fontWeight: 'bold' }}>{task.assignedBy}</span>
                      </span>
                      <span style={{ display: 'block' }}>
                          Due: <span style={{ fontWeight: 'bold' }}>{new Date(task.deadline).toLocaleString()}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
    </div>
</div>
);
};

export default SecureChatApp;