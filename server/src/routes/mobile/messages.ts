import {Router, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryAll, runStatement} from '../../db/helpers';
import {generateId, now} from '../../utils/auth';
import {
  mobileAuthMiddleware,
  MobileAuthRequest,
} from '../../middleware/mobileAuth';
import {broadcastToConversation, notifyAdmins} from '../../websocket';

const router = Router();

// POST /api/messages
router.post(
  '/',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const {
        conversationId,
        type = 'text',
        content,
        replyTo,
        metadata,
      } = req.body;
      const db = await getDb();
      const userId = req.user!.id;
      const ts = now();
      const normalizedMetadata =
        typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      const hasTextContent =
        typeof content === 'string' && content.trim().length > 0;
      const hasMediaPayload =
        !!normalizedMetadata &&
        typeof normalizedMetadata === 'object' &&
        !!(normalizedMetadata as any).url;

      if (
        !conversationId ||
        (!hasTextContent && !hasMediaPayload && type === 'text')
      ) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FIELDS',
            message: 'conversationId and content required',
          },
        });
        return;
      }

      // Verify user is a participant
      const participant = queryOne(
        db,
        'SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
        [conversationId, userId],
      );
      if (!participant) {
        res.status(403).json({
          success: false,
          error: {code: 'FORBIDDEN', message: 'Not a participant'},
        });
        return;
      }

      // Check if blocked by any participant
      const otherParticipants = queryAll(
        db,
        'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?',
        [conversationId, userId],
      );
      for (const other of otherParticipants) {
        const isBlocked = queryOne(
          db,
          'SELECT 1 FROM blocked_users WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
          [userId, other.user_id, other.user_id, userId],
        );
        if (isBlocked) {
          res.status(403).json({
            success: false,
            error: {
              code: 'BLOCKED',
              message: 'Cannot send message to this user',
            },
          });
          return;
        }
      }

      const msgId = generateId();
      const seq = queryAll(
        db,
        'SELECT sequence_number FROM messages WHERE conversation_id = ? ORDER BY sequence_number DESC LIMIT 1',
        [conversationId],
      );
      const nextSeq = seq.length > 0 ? (seq[0].sequence_number || 0) + 1 : 1;

      runStatement(
        db,
        `INSERT INTO messages (id, conversation_id, sender_id, type, content, metadata, reply_to, status, sequence_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          msgId,
          conversationId,
          userId,
          type,
          hasTextContent ? content : null,
          normalizedMetadata ? JSON.stringify(normalizedMetadata) : null,
          replyTo || null,
          'sent',
          nextSeq,
          ts,
          ts,
        ],
      );

      // Update conversation timestamp
      runStatement(db, 'UPDATE conversations SET updated_at = ? WHERE id = ?', [
        ts,
        conversationId,
      ]);

      const message = queryOne(
        db,
        `SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_url as sender_avatar
       FROM messages m INNER JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
        [msgId],
      );

      // Broadcast message to all conversation participants via WebSocket
      broadcastToConversation(
        conversationId,
        {
          type: 'new_message',
          conversationId,
          message,
        },
        userId,
      );

      // If this is a support conversation, alert the admin panel globally so a
      // notification shows even when the admin is not on the chat page.
      const isSupportConv = queryOne(
        db,
        `SELECT cp.conversation_id FROM conversation_participants cp
           INNER JOIN users u ON u.id = cp.user_id
          WHERE cp.conversation_id = ? AND u.username = 'goftegoo_admin' LIMIT 1`,
        [conversationId],
      );
      if (isSupportConv && (message as any)?.sender_username !== 'goftegoo_admin') {
        const preview =
          type === 'text'
            ? String(content || '').slice(0, 80)
            : `Sent a ${type}`;
        notifyAdmins({
          kind: 'message.new',
          title: 'New support message',
          body: `${(message as any)?.sender_name || 'A user'}: ${preview}`,
          icon: '💬',
          level: 'info',
          link: '/chat',
          data: {
            conversationId,
            messageId: msgId,
            senderId: userId,
            senderName: (message as any)?.sender_name,
            type,
            preview,
          },
        });
      }

      res.json({success: true, data: {message}});
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        error: {code: 'INTERNAL', message: 'Failed to send message'},
      });
    }
  },
);

// PUT /api/messages/:id
router.put(
  '/:id',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const {content} = req.body;
      const db = await getDb();
      const userId = req.user!.id;
      const ts = now();

      const msg = queryOne(db, 'SELECT * FROM messages WHERE id = ?', [
        req.params.id,
      ]);
      if (!msg) {
        res.status(404).json({
          success: false,
          error: {code: 'NOT_FOUND', message: 'Message not found'},
        });
        return;
      }
      if (msg.sender_id !== userId) {
        res.status(403).json({
          success: false,
          error: {code: 'FORBIDDEN', message: 'Can only edit own messages'},
        });
        return;
      }

      runStatement(
        db,
        'UPDATE messages SET content = ?, is_edited = 1, updated_at = ? WHERE id = ?',
        [content, ts, req.params.id],
      );

      const updated = queryOne(
        db,
        `SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar_url as sender_avatar
       FROM messages m INNER JOIN users u ON m.sender_id = u.id WHERE m.id = ?`,
        [req.params.id],
      );

      broadcastToConversation(
        msg.conversation_id,
        {
          type: 'message_edited',
          conversationId: msg.conversation_id,
          message: updated,
        },
        userId,
      );

      res.json({success: true, data: {message: updated}});
    } catch (error) {
      console.error('Edit message error:', error);
      res.status(500).json({
        success: false,
        error: {code: 'INTERNAL', message: 'Failed to edit message'},
      });
    }
  },
);

// DELETE /api/messages/:id
router.delete(
  '/:id',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const db = await getDb();
      const userId = req.user!.id;

      const msg = queryOne(db, 'SELECT * FROM messages WHERE id = ?', [
        req.params.id,
      ]);
      if (!msg) {
        res.status(404).json({
          success: false,
          error: {code: 'NOT_FOUND', message: 'Message not found'},
        });
        return;
      }
      if (msg.sender_id !== userId) {
        res.status(403).json({
          success: false,
          error: {code: 'FORBIDDEN', message: 'Can only delete own messages'},
        });
        return;
      }

      runStatement(
        db,
        'UPDATE messages SET is_deleted = 1, content = NULL, updated_at = ? WHERE id = ?',
        [now(), req.params.id],
      );

      broadcastToConversation(
        msg.conversation_id,
        {
          type: 'message_deleted',
          conversationId: msg.conversation_id,
          messageId: req.params.id,
        },
        userId,
      );

      res.json({success: true, data: {message: 'Deleted'}});
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({
        success: false,
        error: {code: 'INTERNAL', message: 'Failed to delete message'},
      });
    }
  },
);

// POST /api/messages/:id/delivered — mark message as delivered
router.post(
  '/:id/delivered',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const db = await getDb();
      const msg = queryOne(db, 'SELECT * FROM messages WHERE id = ?', [
        req.params.id,
      ]);
      if (!msg) {
        res.status(404).json({
          success: false,
          error: {code: 'NOT_FOUND', message: 'Message not found'},
        });
        return;
      }

      if (msg.status === 'sent') {
        runStatement(
          db,
          "UPDATE messages SET status = 'delivered', updated_at = ? WHERE id = ?",
          [now(), req.params.id],
        );
      }

      broadcastToConversation(
        msg.conversation_id,
        {
          type: 'message_delivered',
          conversationId: msg.conversation_id,
          messageId: req.params.id,
        },
        req.user!.id,
      );

      res.json({
        success: true,
        data: {messageId: req.params.id, status: 'delivered'},
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {code: 'INTERNAL', message: 'Failed to update status'},
      });
    }
  },
);

// POST /api/messages/:id/reactions
router.post(
  '/:id/reactions',
  mobileAuthMiddleware,
  async (req: MobileAuthRequest, res: Response) => {
    try {
      const {emoji} = req.body;
      const db = await getDb();
      const userId = req.user!.id;

      if (!emoji) {
        res.status(400).json({
          success: false,
          error: {code: 'MISSING_EMOJI', message: 'emoji required'},
        });
        return;
      }

      const msg = queryOne(
        db,
        'SELECT id, conversation_id FROM messages WHERE id = ?',
        [req.params.id],
      );
      if (!msg) {
        res.status(404).json({
          success: false,
          error: {code: 'NOT_FOUND', message: 'Message not found'},
        });
        return;
      }

      // Toggle reaction
      const existing = queryOne(
        db,
        'SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
        [req.params.id, userId, emoji],
      );

      let action: 'added' | 'removed';
      if (existing) {
        runStatement(
          db,
          'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
          [req.params.id, userId, emoji],
        );
        action = 'removed';
      } else {
        runStatement(
          db,
          'INSERT INTO message_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)',
          [req.params.id, userId, emoji, now()],
        );
        action = 'added';
      }
      saveDb();

      const reactions = queryAll(
        db,
        'SELECT user_id, emoji FROM message_reactions WHERE message_id = ?',
        [req.params.id],
      );

      // Broadcast the updated reaction set to every participant so all devices
      // stay in sync without a refresh.
      broadcastToConversation(msg.conversation_id, {
        type: 'message_reaction',
        conversationId: msg.conversation_id,
        messageId: req.params.id,
        reactions,
        actorId: userId,
        emoji,
        action,
      });

      res.json({success: true, data: {action, emoji, reactions}});
    } catch (error) {
      console.error('Reaction error:', error);
      res.status(500).json({
        success: false,
        error: {code: 'INTERNAL', message: 'Failed to toggle reaction'},
      });
    }
  },
);

export default router;
