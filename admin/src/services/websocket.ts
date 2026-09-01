type MessageHandler = (data: any) => void;

class AdminWebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private _isConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private userToken: string = '';

  get isConnected() {
    return this._isConnected;
  }

  connect(userToken: string) {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.userToken = userToken;
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3001/ws?token=${userToken}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[AdminWS] Connected');
        this._isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data);
        } catch (e) {
          console.error('[AdminWS] Parse error:', e);
        }
      };

      this.ws.onerror = () => {
        console.error('[AdminWS] Error');
      };

      this.ws.onclose = () => {
        console.log('[AdminWS] Disconnected');
        this._isConnected = false;
        this.emit('disconnected', {});
        if (this.userToken) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[AdminWS] Connect error:', error);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.userToken = '';
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'Admin disconnect');
      this.ws = null;
    }
    this._isConnected = false;
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  markRead(conversationId: string) {
    this.send({type: 'read', conversationId});
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: MessageHandler) {
    const list = this.handlers.get(event);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  private emit(event: string, data: any) {
    const list = this.handlers.get(event);
    if (list) {
      list.forEach(handler => {
        try { handler(data); } catch (e) { console.error('[AdminWS] Handler error:', e); }
      });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= 50) return;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.userToken);
    }, delay);
  }
}

export const adminWs = new AdminWebSocketService();
