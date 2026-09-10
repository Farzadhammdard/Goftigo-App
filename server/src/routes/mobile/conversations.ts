import {Router, Response} from 'express';
import {getDb} from '../../db/connection';
import {queryOne, queryAll, queryScalar, runStatement} from '../../db/helpers';
import {generateId, now} from '../../utils/auth';
import {
  mobileAuthMiddleware,
  MobileAuthRequest,
} from '../../middleware/mobileAuth';

const router = Router();

// GET /api/conversations
router.get(
  '/',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const db = await getDb();
      const userId = req.user!.id;
      const {page = '1', pageSize = '20'} = req.query;
      const offset =
        (parseInt(page as string) - 1) * parseInt(pageSize as string);
      const limit = parseInt(pageSize as string);

      const conversations = queryAll(
        db,
        `SELECT c.*, 
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT sender_id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND created_at > COALESCE(
          (SELECT last_read_at FROM conversation_participants WHERE conversation_id = c.id AND user_id = ?), 0
        )) as unread_count
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = ?
      ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC
      LIMIT ? OFFSET ?`,
        [userId, userId, limit, offset],
      );

      // Get participant info for each conversation
      for (const conv of conversations) {
        const participants = queryAll(
          db,
          `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online
         FROM users u INNER JOIN conversation_participants cp ON u.id = cp.user_id
         WHERE cp.conversation_id = ?`,
          [conv.id],
        );
        conv.participants = participants;

        // For direct conversations, get the other user's name as display name
        if (conv.type === 'direct' && participants.length === 2) {
          const other = participants.find((p: any) => p.id !== userId);
          if (other) {
            conv.displayName = other.display_name;
            conv.displayAvatar = other.avatar_url;
          }
        }
      }

      res.json({success: true, data: {conversations}});
    } catch (error) {
      console.error('List conversations error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to list conversations'},
        });
    }
  },
);

// DELETE /api/conversations/:id - remove a conversation from the current user's chat list
router.delete(
  '/:id',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const db = await getDb();
      const participant = queryOne(
        db,
        'SELECT conversation_id FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
        [req.params.id, req.user!.id],
      );
      if (!participant) {
        res
          .status(404)
          .json({
            success: false,
            error: {code: 'NOT_FOUND', message: 'Conversation not found'},
          });
        return;
      }
      runStatement(
        db,
        'DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
        [req.params.id, req.user!.id],
      );
      const remaining =
        queryScalar(
          db,
          'SELECT COUNT(*) as count FROM conversation_participants WHERE conversation_id = ?',
          [req.params.id],
        ) || 0;
      if (remaining === 0)
        runStatement(db, 'DELETE FROM conversations WHERE id = ?', [
          req.params.id,
        ]);
      res.json({success: true, data: {deleted: true}});
    } catch (error) {
      console.error('Delete conversation error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to delete conversation'},
        });
    }
  },
);

// POST /api/conversations/saved — private conversation for personal notes
router.post(
  '/saved',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const db = await getDb();
      const userId = req.user!.id;
      const existing = queryOne(
        db,
        "SELECT id FROM conversations WHERE type = 'saved' AND name = ? LIMIT 1",
        [userId],
      ) as any;
      if (existing) {
        res.json({
          success: true,
          data: {conversationId: existing.id, existing: true},
        });
        return;
      }
      const ts = now();
      const id = generateId();
      runStatement(
        db,
        'INSERT INTO conversations (id, type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, 'saved', userId, ts, ts],
      );
      runStatement(
        db,
        'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [id, userId, 'member', ts],
      );
      res
        .status(201)
        .json({success: true, data: {conversationId: id, existing: false}});
    } catch (error) {
      console.error('Create saved conversation error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to create saved messages'},
        });
    }
  },
);

// POST /api/conversations
router.post(
  '/',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const {type, participantIds, name} = req.body;
      const db = await getDb();
      const userId = req.user!.id;
      const ts = now();

      if (!type || !participantIds || !Array.isArray(participantIds)) {
        res
          .status(400)
          .json({
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: 'type and participantIds required',
            },
          });
        return;
      }

      // For direct conversations, check if one already exists
      if (type === 'direct' && participantIds.length === 1) {
        const otherId = participantIds[0];

        // Check if blocked
        const isBlocked = queryOne(
          db,
          'SELECT 1 FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
          [userId, otherId, otherId, userId],
        );
        if (isBlocked) {
          res
            .status(403)
            .json({
              success: false,
              error: {
                code: 'BLOCKED',
                message: 'Cannot create conversation with this user',
              },
            });
          return;
        }

        const existing = queryOne(
          db,
          `SELECT c.id FROM conversations c
         INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
         INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
         WHERE c.type = 'direct'`,
          [userId, otherId],
        );
        if (existing) {
          res.json({
            success: true,
            data: {conversationId: existing.id, existing: true},
          });
          return;
        }
      }

      const convId = generateId();
      runStatement(
        db,
        'INSERT INTO conversations (id, type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [convId, type, name || null, ts, ts],
      );

      // Add creator and all participants
      const allParticipants = [userId, ...participantIds];
      for (const pid of allParticipants) {
        runStatement(
          db,
          'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
          [convId, pid, pid === userId ? 'admin' : 'member', ts],
        );
      }

      res.json({
        success: true,
        data: {conversationId: convId, existing: false},
      });
    } catch (error) {
      console.error('Create conversation error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to create conversation'},
        });
    }
  },
);

// POST /api/conversations/sync — catch up on messages after reconnect
router.post(
  '/sync',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const {since} = req.body;
      const db = await getDb();
      const userId = req.user!.id;
      const sinceTs = since || 0;

      // Get all conversations with new messages since last sync
      const conversations = queryAll(
        db,
        `SELECT c.id, c.updated_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT sender_id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND created_at > COALESCE(
          (SELECT last_read_at FROM conversation_participants WHERE conversation_id = c.id AND user_id = ?), 0
        )) as unread_count
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE cp.user_id = ? AND c.updated_at > ?
       ORDER BY c.updated_at DESC`,
        [userId, userId, sinceTs],
      );

      // Get new messages per conversation
      const updates: any[] = [];
      for (const conv of conversations) {
        const newMessages = queryAll(
          db,
          `SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_url as sender_avatar
         FROM messages m INNER JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = ? AND m.created_at > ?
         ORDER BY m.created_at ASC`,
          [conv.id, sinceTs],
        );
        updates.push({
          conversationId: conv.id,
          lastMessage: conv.last_message,
          lastMessageAt: conv.last_message_at,
          unreadCount: conv.unread_count,
          newMessages,
        });
      }

      res.json({success: true, data: {updates, serverTime: now()}});
    } catch (error) {
      console.error('Sync error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to sync'},
        });
    }
  },
);

// GET /api/conversations/:id/messages
router.get(
  '/:id/messages',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const db = await getDb();
      const userId = req.user!.id;
      const {before, limit: limitStr = '50'} = req.query;
      const limit = parseInt(limitStr as string);

      // Verify user is a participant
      const participant = queryOne(
        db,
        'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
        [req.params.id, userId],
      );
      if (!participant) {
        res
          .status(403)
          .json({
            success: false,
            error: {code: 'FORBIDDEN', message: 'Not a participant'},
          });
        return;
      }

      let messages;
      if (before) {
        messages = queryAll(
          db,
          `SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_url as sender_avatar
         FROM messages m INNER JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = ? AND m.created_at < ?
         ORDER BY m.created_at DESC LIMIT ?`,
          [req.params.id, parseInt(before as string), limit],
        );
      } else {
        messages = queryAll(
          db,
          `SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_url as sender_avatar
         FROM messages m INNER JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = ?
         ORDER BY m.created_at DESC LIMIT ?`,
          [req.params.id, limit],
        );
      }

      // Get reactions for each message
      for (const msg of messages) {
        msg.reactions = queryAll(
          db,
          'SELECT user_id, emoji FROM message_reactions WHERE message_id = ?',
          [msg.id],
        );
      }

      // Update last read timestamp
      runStatement(
        db,
        'UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?',
        [now(), req.params.id, userId],
      );

      res.json({success: true, data: {messages: messages.reverse()}});
    } catch (error) {
      console.error('Get messages error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to get messages'},
        });
    }
  },
);

export default router;
