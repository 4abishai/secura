    let socket = null;
    let username = null;
    const onlineUsers = new Map();

    function updateStatus(message, className) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = 'status ' + className;
    }

    function addMessage(content, type = 'system') {
        const messagesEl = document.getElementById('messages');
        const messageEl = document.createElement('div');
        messageEl.className = 'message ' + type;
        messageEl.innerHTML = `<strong>[${new Date().toLocaleTimeString()}]</strong> ${content}`;
        messagesEl.appendChild(messageEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function updateButtons(connected) {
        document.getElementById('connectBtn').disabled = connected;
        document.getElementById('disconnectBtn').disabled = !connected;
        document.getElementById('sendBtn').disabled = !connected;
        document.getElementById('getMessagesBtn').disabled = !connected;
        document.getElementById('onlineBtn').disabled = !connected;
        document.getElementById('offlineBtn').disabled = !connected;
    }

    function updateUsers() {
        const usersEl = document.getElementById('users');
        usersEl.innerHTML = '';
        onlineUsers.forEach((online, user) => {
            const userEl = document.createElement('div');
            userEl.className = 'user ' + (online ? 'online' : 'offline');
            userEl.textContent = user + (online ? ' (online)' : ' (offline)');
            usersEl.appendChild(userEl);
        });
    }

    function connect() {
        const serverUrl = document.getElementById('serverUrl').value;
        username = document.getElementById('username').value;

        if (!username) {
            alert('Please enter a username');
            return;
        }

        updateStatus('Connecting...', 'connecting');
        socket = new WebSocket(serverUrl);

        socket.onopen = function() {
            updateStatus('Connected', 'connected');
            updateButtons(true);
            addMessage('Connected to server', 'system');

            // Register user
            send({
                type: 'register',
                username: username
            });
        };

        socket.onmessage = function(event) {
            try {
                const message = JSON.parse(event.data);
                handleMessage(message);
            } catch (error) {
                addMessage('Error parsing message: ' + error.message, 'error');
            }
        };

        socket.onclose = function(event) {
            updateStatus('Disconnected', 'disconnected');
            updateButtons(false);
            addMessage(`Connection closed: ${event.code} - ${event.reason}`, 'system');
        };

        socket.onerror = function(error) {
            addMessage('WebSocket error occurred', 'error');
            console.error('WebSocket error:', error);
        };
    }

    function disconnect() {
        if (socket) {
            socket.close();
            socket = null;
        }
    }

    function send(message) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
            addMessage('SENT: ' + JSON.stringify(message, null, 2), 'sent');
        } else {
            addMessage('Cannot send - not connected', 'error');
        }
    }

    function sendMessage() {
        const recipient = document.getElementById('recipient').value;
        const content = document.getElementById('messageContent').value;

        if (!recipient || !content) {
            alert('Please enter recipient and message content');
            return;
        }

        send({
            type: 'send_message',
            recipient: recipient,
            content: content
        });

        document.getElementById('messageContent').value = '';
    }

    function getMessages() {
        send({
            type: 'get_messages'
        });
    }

    function setPresence(online) {
        send({
            type: 'presence',
            online: online
        });
    }

    function handleMessage(message) {
        addMessage('RECEIVED: ' + JSON.stringify(message, null, 2), 'received');

        switch (message.type) {
            case 'registration_success':
                addMessage(`Successfully registered as ${message.username}`, 'system');
                onlineUsers.set(message.username, true);
                updateUsers();
                break;

            case 'new_message':
                addMessage(`💬 Message from ${message.sender}: "${message.content}"`, 'received');
                break;

            case 'messages_history':
                addMessage(`📜 Loaded ${message.messages.length} historical messages`, 'system');
                message.messages.forEach(msg => {
                    addMessage(`📜 History: ${msg.sender} -> ${msg.recipient}: "${msg.content}" (${new Date(msg.timestamp).toLocaleString()})`, 'system');
                });
                break;

            case 'message_sent':
                const deliveryStatus = message.delivered ? '✅ delivered' : '❌ not delivered';
                addMessage(`Message sent (ID: ${message.messageId}) - ${deliveryStatus}`, 'system');
                break;

            case 'user_presence':
                onlineUsers.set(message.username, message.online);
                updateUsers();
                const status = message.online ? 'came online' : 'went offline';
                addMessage(`👤 ${message.username} ${status}`, 'system');
                break;

            case 'error':
                addMessage(`❌ Server error: ${message.message}`, 'error');
                break;

            default:
                addMessage(`❓ Unknown message type: ${message.type}`, 'system');
        }
    }

    function clearMessages() {
        document.getElementById('messages').innerHTML = '';
    }

    // Handle page unload
    window.addEventListener('beforeunload', function() {
        if (socket) {
            send({
                type: 'presence',
                online: false
            });
        }
    });

    // Auto-focus message input when Enter is pressed
    document.getElementById('messageContent').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });