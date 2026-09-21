import {Server as HttpServer} from 'http';
const WebSocketModule = require('ws');
const WebSocketServer = WebSocketModule.WebSocketServer;
const WebSocket = WebSocketModule.default || WebSocketModule;
import {verifyMobileToken} from './utils/mobileAuth';
import {verifyToken} from './utils/auth';
import {getDb} from './db/connection';
import {queryOne, queryAll, runStatement} from './db/helpers';
import {now} from './utils/auth';

interface AuthenticatedSocket {
  userId?: string;
  isAlive?: boolean;
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: string, listener: (...args: any[]) => void): void;
  ping(): void;
  terminate(): void;
}

const clients = new Map<string, AuthenticatedSocket[]>();
const adminClients: AuthenticatedSocket[] = [];

// The admin panel connects using the `goftegoo_admin` user's mobile token, so its
// sockets live in the `clients` map rather than `adminClients`. We cache that id
// so admin-wide broadcasts reach the panel without a DB read on every event.
let adminContactId: string | null = null;

export function setupWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({server, path: '/ws'});

  wss.on('connection', (ws: AuthenticatedSocket, req: any) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'No token provided');
      return;
    }

    try {
      // Try admin token first
      let payload: any = null;
      let isAdmin = false;
      try {
        payload = verifyToken(token);
        // Check if payload has admin role
        isAdmin = payload.role && (payload.role === 'super_admin' || payload.role === 'admin');
      } catch {
        payload = verifyMobileToken(token);
        isAdmin = false;
      }

      ws.userId = payload.userId;
      ws.isAlive = true;

      if (isAdmin) {
        adminClients.push(ws);
        console.log('[WS] Admin connected');

        ws.on('close', () => {
          const idx = adminClients.indexOf(ws);
          if (idx >= 0) adminClients.splice(idx, 1);
          console.log('[WS] Admin disconnected');
        });

        ws.send(JSON.stringify({type: 'connected', message: 'Connected to Goftegoo WebSocket (Admin)', userId: payload.userId}));
      } else {
        if (!clients.has(payload.userId)) {
          clients.set(payload.userId, []);
        }
        clients.get(payload.userId)!.push(ws);

        getDb().then(db => {
          runStatement(db, 'UPDATE users SET is_online = 1, last_seen_at = ? WHERE id = ?', [now(), payload.userId]);
          broadcastUserStatus(payload.userId, true);
        });

        console.log(`[WS] User ${payload.userId} connected (total: ${clients.get(payload.userId)?.length})`);

        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            handleMessage(ws, msg);
          } catch (e) {
            ws.send(JSON.stringify({type: 'error', message: 'Invalid message format'}));
          }
        });

        ws.on('close', () => {
          const userClients = clients.get(payload.userId) || [];
          clients.set(payload.userId, userClients.filter(c => c !== ws));

          if (clients.get(payload.userId)?.length === 0) {
            clients.delete(payload.userId);
            getDb().then(db => {
              runStatement(db, 'UPDATE users SET is_online = 0, last_seen_at = ? WHERE id = ?', [now(), payload.userId]);
              broadcastUserStatus(payload.userId, false);
            });
          }
          console.log(`[WS] User ${payload.userId} disconnected`);
        });

        ws.send(JSON.stringify({type: 'connected', message: 'Connected to Goftegoo WebSocket', userId: payload.userId}));
      }
    } catch (error) {
      ws.close(1008, 'Invalid token');
    }
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedSocket) => {
      if (!ws.isAlive) {
        const uid = ws.userId || '';
        const userClients = clients.get(uid) || [];
        clients.set(uid, userClients.filter(c => c !== ws));
        if (clients.get(uid)?.length === 0) clients.delete(uid);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  console.log('WebSocket server initialized on /ws');
}

export function broadcastUserStatus(userId: string, isOnline: boolean): void {
  getDb().then(db => {
    const user = queryOne(db, 'SELECT status FROM users WHERE id = ?', [userId]) as {status: string} | undefined;
    const status = user?.status || 'active';

    // Notify contacts
    const conversations = queryAll(db,
      'SELECT DISTINCT conversation_id FROM conversation_participants WHERE user_id = ?',
      [userId]
    );
    for (const conv of conversations) {
      const participants = queryAll(db,
        'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?',
        [conv.conversation_id, userId]
      );
      for (const p of participants) {
        sendToUser(p.user_id, {
          type: 'user_status',
          userId,
          isOnline,
          lastSeen: now(),
        });
      }
    }

    // Notify admins
    broadcastToAdmins({type: 'user_status', userId, isOnline, lastSeenAt: now(), status});
  });
}

/**
 * Deliver an event to every connected admin surface: JWT-authenticated admins
 * and the admin panel (which is connected as the `goftegoo_admin` user).
 */
export function broadcastToAdmins(message: any): void {
  const data = JSON.stringify(message);
  adminClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  });

  if (adminContactId) {
    sendToUser(adminContactId, message);
    return;
  }
  getDb()
    .then(db => {
      const admin = queryOne(
        db,
        "SELECT id FROM users WHERE username = 'goftegoo_admin'",
      ) as {id: string} | undefined;
      if (admin) {
        adminContactId = admin.id;
        sendToUser(admin.id, message);
      }
    })
    .catch(() => {});
}

/** Convenience helper to push a rich notification/activity event to admins. */
export function notifyAdmins(event: {
  kind: string;
  title: string;
  body: string;
  icon?: string;
  level?: 'info' | 'success' | 'warning' | 'danger';
  link?: string;
  data?: any;
}): void {
  broadcastToAdmins({
    type: 'admin:event',
    at: now(),
    level: 'info',
    icon: '🔔',
    link: '',
    ...event,
  });
}

function handleMessage(ws: AuthenticatedSocket, msg: any): void {
  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({type: 'pong', timestamp: Date.now()}));
      break;
    case 'typing':
      if (msg.conversationId) {
        broadcastToConversation(msg.conversationId, {
          type: 'typing',
          conversationId: msg.conversationId,
          userId: ws.userId,
          isTyping: msg.isTyping !== false,
        }, ws.userId);
      }
      break;
    case 'read':
      if (msg.conversationId) {
        getDb().then(db => {
          const ts = now();
          runStatement(db,
            'UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?',
            [ts, msg.conversationId, ws.userId]
          );

          const participants = queryAll(db,
            'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?',
            [msg.conversationId, ws.userId]
          );
          for (const p of participants) {
            sendToUser(p.user_id, {
              type: 'messages_read',
              conversationId: msg.conversationId,
              userId: ws.userId,
              readAt: ts,
            });
          }
        });
      }
      break;
    default:
      ws.send(JSON.stringify({type: 'error', message: `Unknown message type: ${msg.type}`}));
  }
}

export function broadcastToConversation(conversationId: string, message: any, excludeUserId?: string): void {
  getDb().then(db => {
    const participants = queryAll(db,
      'SELECT user_id FROM conversation_participants WHERE conversation_id = ?',
      [conversationId]
    );

    // Get conversation metadata for the update event
    const conv = queryOne(db,
      `SELECT c.*,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT sender_id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
       FROM conversations c WHERE c.id = ?`,
      [conversationId]
    );

    for (const p of participants) {
      if (p.user_id !== excludeUserId) {
        sendToUser(p.user_id, message);

        // Also send conversation:updated so chat list refreshes in real time
        sendToUser(p.user_id, {
          type: 'conversation:updated',
          conversationId,
          conversation: conv,
        });
      }
    }
  });
}

export function sendToUser(userId: string, message: any): void {
  const userClients = clients.get(userId);
  if (userClients) {
    const data = JSON.stringify(message);
    userClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

export function broadcastToAll(message: any): void {
  const data = JSON.stringify(message);
  clients.forEach(userClients => {
    userClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });
}

export function isUserOnline(userId: string): boolean {
  return clients.has(userId) && clients.get(userId)!.length > 0;
}
