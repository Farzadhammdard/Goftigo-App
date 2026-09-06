import {Config} from '../constants/config';

type MessageHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string = '';
  private handlers: Map<string, MessageHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 50;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private _isConnected = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private lastSyncTime: number = Date.now();
  private onReconnectSync: (() => Promise<void>) | null = null;

  get isConnected() {
    return this._isConnected;
  }

  setReconnectSyncHandler(handler: () => Promise<void>) {
    this.onReconnectSync = handler;
  }

  connect(token: string) {
    if (this.isConnecting || this._isConnected) return;

    this.token = token;
    this.url = `${Config.API.WS_URL}?token=${token}`;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this._isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected', {});

        // Sync missed messages after reconnect
        if (this.onReconnectSync) {
          this.onReconnectSync();
        }

        // Start ping interval
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          this.send({type: 'ping'});
        }, 25000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.lastSyncTime = Date.now();
          this.emit(data.type, data);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[WS] Error');
      };

      this.ws.onclose = (event) => {
        console.log('[WS] Closed:', event.code, event.reason);
        this._isConnected = false;
        this.isConnecting = false;

        if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
        }

        this.emit('disconnected', {});

        // 1008 = policy violation (invalid token) — don't retry, force logout
        if (event.code === 1008) {
          console.log('[WS] Auth failed — token invalid, forcing logout');
          this.emit('auth_error', {});
          return;
        }

        if (event.code !== 1000 && this.token) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      console.error('[WS] Connect error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.token = '';
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    this._isConnected = false;
    this.isConnecting = false;
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendTyping(conversationId: string, isTyping: boolean = true) {
    this.send({type: 'typing', conversationId, isTyping});
  }

  markRead(conversationId: string) {
    this.send({type: 'read', conversationId});
  }

  getLastSyncTime(): number {
    return this.lastSyncTime;
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
        try {
          handler(data);
        } catch (e) {
          console.error('[WS] Handler error:', e);
        }
      });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      this.emit('reconnect_failed', {});
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.isConnecting = false;
      this.connect(this.token);
    }, delay);
  }
}

export const wsService = new WebSocketService();
