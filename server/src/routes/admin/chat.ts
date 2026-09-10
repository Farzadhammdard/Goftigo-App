import {Router, Response} from 'express';
import {getDb} from '../../db/connection';
import {queryOne, queryAll, runStatement} from '../../db/helpers';
import {generateId, now} from '../../utils/auth';
import {generateMobileAccessToken} from '../../utils/mobileAuth';
import {authMiddleware, AuthenticatedRequest} from '../../middleware/auth';
import {broadcastToConversation} from '../../websocket';
import fs from 'fs';
import path from 'path';
import {isAllowedMediaType, buildUploadFilename} from '../../utils/media';

const router = Router();

// All routes require admin auth
router.use(authMiddleware);

// GET /api/admin/chat/admin-ws-token — get WS token for admin to connect as goftegoo_admin
router.get(
  '/admin-ws-token',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const adminContact = queryOne(
        db,
        "SELECT id FROM users WHERE username = 'goftegoo_admin'",
      ) as any;
      if (!adminContact) {
        res
          .status(500)
          .json({
            success: false,
            error: {
              code: 'ADMIN_NOT_FOUND',
              message: 'Admin contact user not found',
            },
          });
        return;
      }
      const token = generateMobileAccessToken(adminContact.id);
      res.json({success: true, data: {token}});
    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to generate token'},
        });
    }
  },
);

// GET /api/admin/chat/conversations
router.get(
  '/conversations',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const adminUserId = req.admin!.id;

      // Find the goftegoo_admin user
      const adminContact = queryOne(
        db,
        "SELECT id FROM users WHERE username = 'goftegoo_admin'",
      ) as any;
      if (!adminContact) {
        res.json({success: true, data: []});
        return;
      }

      const conversations = queryAll(
        db,
        `SELECT c.*,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT sender_id FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_sender,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != ? AND created_at > COALESCE(
          (SELECT last_read_at FROM conversation_participants WHERE conversation_id = c.id AND user_id = ?), 0
        )) as unread_count
      FROM conversations c
      INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = ?
      ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC`,
        [adminContact.id, adminContact.id, adminContact.id],
      );

      // Get participant info
      for (const conv of conversations) {
        const participants = queryAll(
          db,
          `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online, u.public_user_id
         FROM users u INNER JOIN conversation_participants cp ON u.id = cp.user_id
         WHERE cp.conversation_id = ?`,
          [conv.id],
        );
        conv.participants = participants;

        if (conv.type === 'direct' && participants.length === 2) {
          const other = participants.find((p: any) => p.id !== adminContact.id);
          if (other) {
            conv.displayName = other.display_name;
            conv.displayAvatar = other.avatar_url;
            conv.displayUserId = other.id;
            conv.displayUsername = other.username;
            conv.displayPublicUserId = other.public_user_id;
          }
        }
      }

      res.json({success: true, data: conversations});
    } catch (error) {
      console.error('Admin list conversations error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to list conversations'},
        });
    }
  },
);

// Create or return the direct support conversation for any user.
router.post(
  '/conversations/user/:userId',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const adminContact = queryOne(
        db,
        "SELECT id FROM users WHERE username = 'goftegoo_admin'",
      ) as any;
      const target = queryOne(
        db,
        'SELECT id FROM users WHERE id = ? AND status = ?',
        [req.params.userId, 'active'],
      ) as any;
      if (!adminContact || !target) {
        res
          .status(404)
          .json({
            success: false,
            error: {code: 'NOT_FOUND', message: 'User not found'},
          });
        return;
      }
      const existing = queryOne(
        db,
        `SELECT cp1.conversation_id as id FROM conversation_participants cp1
      INNER JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      INNER JOIN conversations c ON c.id = cp1.conversation_id
      WHERE cp1.user_id = ? AND cp2.user_id = ? AND c.type = 'direct'`,
        [adminContact.id, target.id],
      ) as any;
      if (existing) {
        res.json({success: true, data: {conversationId: existing.id}});
        return;
      }
      const conversationId = generateId();
      const ts = now();
      runStatement(
        db,
        'INSERT INTO conversations (id, type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [conversationId, 'direct', null, ts, ts],
      );
      runStatement(
        db,
        'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [conversationId, adminContact.id, 'admin', ts],
      );
      runStatement(
        db,
        'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [conversationId, target.id, 'member', ts],
      );
      res.json({success: true, data: {conversationId}});
    } catch (error) {
      console.error('Create admin conversation error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to create conversation'},
        });
    }
  },
);

// GET /api/admin/chat/conversations/:id/messages
router.get(
  '/conversations/:id/messages',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await getDb();
      const {limit: limitStr = '50', before} = req.query;
      const limit = parseInt(limitStr as string);

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

      // Update admin read timestamp
      const adminContact = queryOne(
        db,
        "SELECT id FROM users WHERE username = 'goftegoo_admin'",
      ) as any;
      if (adminContact) {
        runStatement(
          db,
          'UPDATE conversation_participants SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?',
          [now(), req.params.id, adminContact.id],
        );
      }

      res.json({success: true, data: messages.reverse()});
    } catch (error) {
      console.error('Admin get messages error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to get messages'},
        });
    }
  },
);

// POST /api/admin/chat/conversations/:id/messages
router.post(
  '/conversations/:id/messages',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {content} = req.body;
      const db = await getDb();
      const ts = now();

      if (!content) {
        res
          .status(400)
          .json({
            success: false,
            error: {code: 'MISSING_FIELDS', message: 'content required'},
          });
        return;
      }

      // Find the goftegoo_admin user
      const adminContact = queryOne(
        db,
        "SELECT id FROM users WHERE username = 'goftegoo_admin'",
      ) as any;
      if (!adminContact) {
        res
          .status(500)
          .json({
            success: false,
            error: {
              code: 'ADMIN_NOT_FOUND',
              message: 'Admin contact user not found',
            },
          });
        return;
      }

      // Verify conversation exists
      const conv = queryOne(db, 'SELECT id FROM conversations WHERE id = ?', [
        req.params.id,
      ]);
      if (!conv) {
        res
          .status(404)
          .json({
            success: false,
            error: {code: 'NOT_FOUND', message: 'Conversation not found'},
          });
        return;
      }

      const msgId = generateId();
      const seq = queryAll(
        db,
        'SELECT sequence_number FROM messages WHERE conversation_id = ? ORDER BY sequence_number DESC LIMIT 1',
        [req.params.id],
      );
      const nextSeq = seq.length > 0 ? (seq[0].sequence_number || 0) + 1 : 1;

      runStatement(
        db,
        `INSERT INTO messages (id, conversation_id, sender_id, type, content, status, sequence_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          msgId,
          req.params.id,
          adminContact.id,
          'text',
          content,
          'sent',
          nextSeq,
          ts,
          ts,
        ],
      );

      runStatement(db, 'UPDATE conversations SET updated_at = ? WHERE id = ?', [
        ts,
        req.params.id,
      ]);

      const message = queryOne(
        db,
        `SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_url as sender_avatar
       FROM messages m INNER JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
        [msgId],
      );

      // Broadcast via WebSocket
      broadcastToConversation(
        req.params.id,
        {
          type: 'new_message',
          conversationId: req.params.id,
          message,
        },
        adminContact.id,
      );

      res.json({success: true, data: {message}});
    } catch (error) {
      console.error('Admin send message error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to send message'},
        });
    }
  },
);

router.post(
  '/conversations/:id/media',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {data, mimeType, filename, type = 'file'} = req.body;
      const normalizedMime =
        typeof mimeType === 'string'
          ? mimeType.toLowerCase().split(';')[0].trim()
          : '';
      if (!data || !isAllowedMediaType(normalizedMime)) {
        res
          .status(400)
          .json({
            success: false,
            error: {
              code: 'INVALID_MEDIA',
              message: 'Valid data and file type are required',
            },
          });
        return;
      }
      const db = await getDb();
      const conversation = queryOne(
        db,
        'SELECT id FROM conversations WHERE id = ?',
        [req.params.id],
      );
      if (!conversation) {
        res
          .status(404)
          .json({
            success: false,
            error: {code: 'NOT_FOUND', message: 'Conversation not found'},
          });
        return;
      }
      const buffer = Buffer.from(
        String(data).replace(/^data:[^;]+;base64,/, ''),
        'base64',
      );
      if (!buffer.length || buffer.length > 100 * 1024 * 1024) {
        res
          .status(413)
          .json({
            success: false,
            error: {
              code: 'FILE_TOO_LARGE',
              message: 'Invalid or oversized file',
            },
          });
        return;
      }
      const uploadDir = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'data',
        'uploads',
      );
      fs.mkdirSync(uploadDir, {recursive: true});
      const fileName = buildUploadFilename(normalizedMime);
      fs.writeFileSync(path.join(uploadDir, fileName), buffer);
      const baseUrl =
        process.env.API_URL || `${req.protocol}://${req.get('host')}`;
      const metadata = JSON.stringify({
        url: `${baseUrl}/api/media/file/${fileName}`,
        fileName: filename || fileName,
        mimeType: normalizedMime,
      });
      const adminContact = queryOne(
        db,
        "SELECT id FROM users WHERE username = 'goftegoo_admin'",
      ) as any;
      const ts = now();
      const msgId = generateId();
      const seq = queryAll(
        db,
        'SELECT sequence_number FROM messages WHERE conversation_id = ? ORDER BY sequence_number DESC LIMIT 1',
        [req.params.id],
      );
      runStatement(
        db,
        `INSERT INTO messages (id, conversation_id, sender_id, type, content, metadata, status, sequence_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          msgId,
          req.params.id,
          adminContact.id,
          type,
          null,
          metadata,
          'sent',
          seq.length ? (seq[0].sequence_number || 0) + 1 : 1,
          ts,
          ts,
        ],
      );
      runStatement(db, 'UPDATE conversations SET updated_at = ? WHERE id = ?', [
        ts,
        req.params.id,
      ]);
      const message = queryOne(
        db,
        `SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_url as sender_avatar FROM messages m INNER JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
        [msgId],
      );
      broadcastToConversation(
        req.params.id,
        {type: 'new_message', conversationId: req.params.id, message},
        adminContact.id,
      );
      res.json({success: true, data: {message}});
    } catch (error) {
      console.error('Admin media upload error:', error);
      res
        .status(500)
        .json({
          success: false,
          error: {code: 'INTERNAL', message: 'Failed to upload media'},
        });
    }
  },
);

export default router;
