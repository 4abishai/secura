// services/websocket.js
class WebSocketService {
  constructor() {
    this.ws = null;
    this.messageHandlers = new Map();
    this.connected = false;
    this.username = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 8080;
  }

  connect(wsUrl = 'ws://localhost:8080/chat') {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          this.connected = false;
          
          // Attempt to reconnect if not a manual close
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
              this.reconnectAttempts++;
              console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
              this.connect(wsUrl);
            }, this.reconnectDelay);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
      this.connected = false;
    }
  }

  send(message) {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
      throw new Error('WebSocket not connected');
    }
  }

  handleMessage(message) {
    const { type } = message;
    const handlers = this.messageHandlers.get(type) || [];
    handlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error in message handler for type ${type}:`, error);
      }
    });
  }

  // Register message handlers
  onMessage(type, handler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type).push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  // WebSocket API methods
  registerUser(username) {
    this.username = username;
    return this.send({
      type: 'register',
      username: username
    });
  }

  sendMessage(recipient, content, tempId) {
    return this.send({
      type: 'send_message',
      recipient: recipient,
      content: content,
      tempId: tempId
    });
  }

  updatePresence(online) {
    return this.send({
      type: 'presence',
      online: online
    });
  }

  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Create singleton instance
const websocketService = new WebSocketService();
export default websocketService;