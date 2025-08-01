import React, { useEffect, useState } from 'react';
import { 
  generateOrLoadKeyPair, 
  importPublicKey, 
  deriveAESKey, 
  encryptMessage, 
  decryptMessage, 
  exportKeyBytes 
} from './utils/crypto';
import { registerUser, loginUser, fetchUsers, sendMessage, fetchMessages } from './services/api';
import Registration from './components/Registration';
import UserList from './components/UserList';
import MessageInput from './components/MessageInput';
import MessageList from './components/MessageList';

const SecureChatApp = () => {
  const [username, setUsername] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [privateKey, setPrivateKey] = useState(null);
  const [publicKeyBase64, setPublicKeyBase64] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [polling, setPolling] = useState(null);
  const [isLogin, setIsLogin] = useState(false);

const handleRegisterUser = async () => {
  if (!inputUsername.trim()) {
    alert('Please enter a username');
    return;
  }

  if (!inputPassword.trim()) {
    alert('Please enter password');
    return;
  }

  try {
    const { privateKey: privKey, publicKey: pubKey } = await generateOrLoadKeyPair();

    if (!isLogin) {
      await registerUser(inputUsername, pubKey, inputPassword);
    } else {
      await loginUser(inputUsername, pubKey, inputPassword);
    }

    localStorage.setItem('username', inputUsername);
    setUsername(inputUsername);
    setPrivateKey(privKey);
    setPublicKeyBase64(pubKey);

    await handleFetchUsers();
    startPolling();
  } catch (error) {
    console.error('Authentication error:', error);
    alert(`${isLogin ? 'Login' : 'Registration'} failed: ${error.message}`);
  }
};


  const handleFetchUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data.filter(u => u.username !== username));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedUser) return;

    try {
      const recipient = users.find(u => u.username === selectedUser);
      if (!recipient) {
        alert('Recipient not found');
        return;
      }

      const recipientPubKey = await importPublicKey(recipient.publicKey);
      const aesKey = await deriveAESKey(privateKey, recipientPubKey);

      const keyHex = await exportKeyBytes(aesKey);
      console.log(`[${username}] Shared key with ${selectedUser}: ${keyHex}`);

      const encrypted = await encryptMessage(aesKey, message);
      
      await sendMessage({
        sender: username,
        recipient: selectedUser,
        content: encrypted,
        timestamp: new Date().toISOString()
      });

      setMessage('');
      await handleFetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    }
  };

  const handleFetchMessages = async () => {
    if (!username || !privateKey) return;

    try {
      const data = await fetchMessages(username);
      console.log('Fetched messages:', data);

      const allUsers = await fetchUsers();
      const userMap = {};
      allUsers.forEach(user => {
        userMap[user.username] = user;
      });

      const decrypted = await Promise.all(
        data.map(async (msg) => {
          try {
            const otherUsername = msg.sender === username ? msg.recipient : msg.sender;
            const otherUser = userMap[otherUsername];
            
            if (!otherUser) {
              console.warn(`Could not find user: ${otherUsername}`);
              return { ...msg, decrypted: `[Unknown user: ${otherUsername}]` };
            }

            const otherUserPubKey = await importPublicKey(otherUser.publicKey);
            const aesKey = await deriveAESKey(privateKey, otherUserPubKey);

            const keyHex = await exportKeyBytes(aesKey);
            console.log(`[${username}] Shared key with ${otherUsername}: ${keyHex}`);

            const decryptedText = await decryptMessage(aesKey, msg.content);
            return { ...msg, decrypted: decryptedText };
          } catch (error) {
            console.error('Failed to decrypt message:', error, msg);
            return { ...msg, decrypted: '[Decryption Failed]' };
          }
        })
      );

      console.log('All decrypted messages:', decrypted);
      setMessages(decrypted.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const startPolling = () => {
    if (polling) clearInterval(polling);
    const id = setInterval(handleFetchMessages, 3000);
    setPolling(id);
  };

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
      (async () => {
        try {
          const { privateKey: privKey, publicKey: pubKey } = await generateOrLoadKeyPair();
          setPrivateKey(privKey);
          setPublicKeyBase64(pubKey);
          await handleFetchUsers();
          startPolling();
        } catch (error) {
          console.error('Failed to initialize:', error);
        }
      })();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (polling) clearInterval(polling);
    };
  }, [polling]);

  if (!username) {
  return (
    <Registration 
      inputUsername={inputUsername}
      inputPassword={inputPassword}
      onUsernameChange={setInputUsername}
      onPasswordChange={setInputPassword}
      onRegister={handleRegisterUser}
      isLogin={isLogin}
      onToggleMode={() => setIsLogin(!isLogin)}
    />
  );
  }

  return (
    <div style={{ padding: 20, fontFamily: 'Arial', maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Welcome, {username}</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        <div>
          <UserList 
            users={users}
            selectedUser={selectedUser}
            onUserSelect={setSelectedUser}
            onRefresh={handleFetchUsers}
          />

          <MessageInput 
            selectedUser={selectedUser}
            message={message}
            onMessageChange={setMessage}
            onSendMessage={handleSendMessage}
          />
        </div>

        <MessageList 
          messages={messages}
          currentUsername={username}
          onRefresh={handleFetchMessages}
        />
      </div>
    </div>
  );
};

export default SecureChatApp;