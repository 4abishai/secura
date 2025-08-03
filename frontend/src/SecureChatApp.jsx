// src/SecureChatApp.jsx
import React, { useEffect, useState } from 'react';
import indexedDBService from './services/IndexedDB';
import {
  generateOrLoadKeyPair,
  importPublicKey,
  deriveAESKey,
  encryptMessage,
  decryptMessage
} from './utils/crypto';
import { registerUser, loginUser, fetchUsers, sendMessage, fetchMessages } from './services/api';
import Registration from './components/Registration';
import UserList from './components/UserList';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';

export default function SecureChatApp() {
  const [dbReady, setDbReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState(null);
  const [publicKey, setPublicKey] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [poller, setPoller] = useState(null);

  // Init IndexedDB & session
  useEffect(() => {
    (async()=> {
      await indexedDBService.initDB();
      setDbReady(true);
      // restore session if exists
      const all = await indexedDBService.getAllUsers();
      if (all.length) {
        const last = all.reduce((a,b)=> new Date(a.lastAccessed)>new Date(b.lastAccessed)?a:b);
        await restoreSession(last.username);
      }
      setLoading(false);
    })();
    return ()=> indexedDBService.closeDB();
  }, []);

  async function restoreSession(user) {
    const { privateKey, publicKey } = await generateOrLoadKeyPair(user);
    setUsername(user);
    setPrivateKey(privateKey);
    setPublicKey(publicKey);
    await loadUsers(user);
    startPolling(user, privateKey);
  }

  async function handleAuth(isLogin) {
    if (!username||!password) return alert('Enter creds');
    const { privateKey, publicKey } = await generateOrLoadKeyPair(username);
    if (isLogin) await loginUser(username, publicKey, password);
    else await registerUser(username, publicKey, password);
    await loadUsers(username);
    startPolling(username, privateKey);
  }

  async function loadUsers(me) {
    const list = await fetchUsers();
    setUsers(list.filter(u=>u.username!==me));
  }

  function startPolling(me, priv) {
    if (poller) clearInterval(poller);
    const id = setInterval(()=>fetchAndDecrypt(me, priv),3000);
    setPoller(id);
  }

  async function fetchAndDecrypt(me, priv) {
    const data = await fetchMessages(me);
    const all = await fetchUsers();
    const map = Object.fromEntries(all.map(u=>[u.username,u]));
    const dec = await Promise.all(data.map(async m => {
      const other = m.sender===me?m.recipient:m.sender;
      const pub = await importPublicKey(map[other].publicKey);
      const key = await deriveAESKey(priv, pub);
      return { ...m, text: await decryptMessage(key,m.content) };
    }));
    setMessages(dec.sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)));
  }

  async function handleSend() {
    if (!message||!selectedUser) return;
    const recPub = await importPublicKey(users.find(u=>u.username===selectedUser).publicKey);
    const aes = await deriveAESKey(privateKey, recPub);
    const ct = await encryptMessage(aes, message);
    await sendMessage({ sender:username, recipient:selectedUser, content:ct, timestamp:new Date().toISOString() });
    setMessage('');
    fetchAndDecrypt(username, privateKey);
  }

  if (loading) return <div>Initializing...</div>;
  if (!username) {
    return (
      <Registration
        username={username} setUsername={setUsername}
        password={password} setPassword={setPassword}
        onRegister={()=>handleAuth(false)}
        onLogin={()=>handleAuth(true)}
      />
    );
  }
  return (
    <div>
      <h2>Welcome, {username}</h2>
      <button onClick={()=>{ clearInterval(poller);setUsername(''); }}>Logout</button>
      <UserList users={users} selected={selectedUser} onSelect={setSelectedUser}/>
      <MessageList messages={messages} me={username} them={selectedUser}/>
      <MessageInput
        message={message} setMessage={setMessage}
        onSend={handleSend}
      />
    </div>
  );
}
