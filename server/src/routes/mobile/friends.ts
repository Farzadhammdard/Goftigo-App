import {Router, Response} from 'express';
import {getDb} from '../../db/connection';
import {queryOne, queryAll, queryScalar, runStatement} from '../../db/helpers';
import {generateId, now} from '../../utils/auth';
import {mobileAuthMiddleware, MobileAuthRequest} from '../../middleware/mobileAuth';
import {sendToUser} from '../../websocket';

const router = Router();

// POST /api/friends/request — Send friend request
router.post('/request', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {userId} = req.body;
    const fromId = req.user!.id;
    if (!userId || userId === fromId) {
      res.status(400).json({success: false, error: {code: 'INVALID', message: 'Invalid user'}});
      return;
    }
    const db = await getDb();
    const target = queryOne(db, 'SELECT id, username, display_name FROM users WHERE id = ? AND status = ?', [userId, 'active']) as any;
    if (!target) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'User not found'}});
      return;
    }
    // Check existing friendship
    const existing = queryOne(db,
      'SELECT * FROM friendships WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)',
      [fromId, userId, userId, fromId]
    );
    if (existing) {
      res.status(409).json({success: false, error: {code: 'ALREADY_FRIENDS', message: 'Already friends'}});
      return;
    }
    // Check pending request
    const pending = queryOne(db,
      "SELECT * FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'",
      [fromId, userId]
    );
    if (pending) {
      res.status(409).json({success: false, error: {code: 'REQUEST_SENT', message: 'Request already sent'}});
      return;
    }
    // Check reverse pending request — auto-accept
    const reverse = queryOne(db,
      "SELECT * FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'",
      [userId, fromId]
    ) as any;
    const ts = now();
    if (reverse) {
      // Auto-accept: create friendship, update both requests
      const [id1, id2] = [fromId, userId].sort();
      runStatement(db, 'INSERT OR IGNORE INTO friendships (user_id_1, user_id_2, created_at) VALUES (?, ?, ?)', [id1, id2, ts]);
      runStatement(db, "UPDATE friend_requests SET status = 'accepted', updated_at = ? WHERE id = ?", [ts, reverse.id]);
      const frId = generateId();
      runStatement(db, "INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at, updated_at) VALUES (?, ?, ?, 'accepted', ?, ?)",
        [frId, fromId, userId, ts, ts]);
      // Notification
      const notifId = generateId();
      const me = queryOne(db, 'SELECT username, display_name FROM users WHERE id = ?', [fromId]) as any;
      runStatement(db, 'INSERT INTO notifications (id, user_id, type, title, body, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [notifId, userId, 'friend_accepted', 'Friend request accepted', `${me.display_name} accepted your friend request`, JSON.stringify({fromUserId: fromId}), ts]);
      sendToUser(userId, {type: 'notification', notification: {id: notifId, type: 'friend_accepted', title: 'Friend request accepted', body: `${me.display_name} accepted your friend request`, createdAt: ts}});
      res.json({success: true, data: {status: 'accepted'}});
      return;
    }
    // Create new request
    const reqId = generateId();
    runStatement(db, "INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)",
      [reqId, fromId, userId, ts, ts]);
    // Notification
    const me = queryOne(db, 'SELECT username, display_name FROM users WHERE id = ?', [fromId]) as any;
    const notifId = generateId();
    runStatement(db, 'INSERT INTO notifications (id, user_id, type, title, body, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [notifId, userId, 'friend_request', 'New friend request', `${me.display_name} sent you a friend request`, JSON.stringify({fromUserId: fromId, requestId: reqId}), ts]);
    sendToUser(userId, {type: 'notification', notification: {id: notifId, type: 'friend_request', title: 'New friend request', body: `${me.display_name} sent you a friend request`, createdAt: ts}});
    res.json({success: true, data: {status: 'pending', requestId: reqId}});
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to send friend request'}});
  }
});

// POST /api/friends/accept/:requestId
router.post('/accept/:requestId', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const request = queryOne(db, "SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'",
      [req.params.requestId, req.user!.id]) as any;
    if (!request) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Request not found'}});
      return;
    }
    const ts = now();
    const [id1, id2] = [request.from_user_id, request.to_user_id].sort();
    runStatement(db, 'INSERT OR IGNORE INTO friendships (user_id_1, user_id_2, created_at) VALUES (?, ?, ?)', [id1, id2, ts]);
    runStatement(db, "UPDATE friend_requests SET status = 'accepted', updated_at = ? WHERE id = ?", [ts, request.id]);
    // Notification to requester
    const me = queryOne(db, 'SELECT display_name FROM users WHERE id = ?', [req.user!.id]) as any;
    const notifId = generateId();
    runStatement(db, 'INSERT INTO notifications (id, user_id, type, title, body, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [notifId, request.from_user_id, 'friend_accepted', 'Friend request accepted', `${me.display_name} accepted your friend request`, JSON.stringify({fromUserId: req.user!.id}), ts]);
    sendToUser(request.from_user_id, {type: 'notification', notification: {id: notifId, type: 'friend_accepted', title: 'Friend request accepted', body: `${me.display_name} accepted your friend request`, createdAt: ts}});
    res.json({success: true, data: {status: 'accepted'}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to accept request'}});
  }
});

// POST /api/friends/reject/:requestId
router.post('/reject/:requestId', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const request = queryOne(db, "SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'",
      [req.params.requestId, req.user!.id]) as any;
    if (!request) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Request not found'}});
      return;
    }
    runStatement(db, "UPDATE friend_requests SET status = 'rejected', updated_at = ? WHERE id = ?", [now(), request.id]);
    res.json({success: true, data: {status: 'rejected'}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to reject request'}});
  }
});

// POST /api/friends/cancel/:userId
router.post('/cancel/:userId', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    runStatement(db, "UPDATE friend_requests SET status = 'cancelled', updated_at = ? WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'",
      [now(), req.user!.id, req.params.userId]);
    res.json({success: true, data: {status: 'cancelled'}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to cancel request'}});
  }
});

// POST /api/friends/remove/:userId — Remove friend
router.post('/remove/:userId', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const [id1, id2] = [req.user!.id, req.params.userId].sort();
    runStatement(db, 'DELETE FROM friendships WHERE user_id_1 = ? AND user_id_2 = ?', [id1, id2]);
    res.json({success: true});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to remove friend'}});
  }
});

// GET /api/friends — List friends
router.get('/', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const uid = req.user!.id;
    const friends = queryAll(db,
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online, u.last_seen_at
       FROM friendships f
       JOIN users u ON (u.id = CASE WHEN f.user_id_1 = ? THEN f.user_id_2 ELSE f.user_id_1 END)
       WHERE f.user_id_1 = ? OR f.user_id_2 = ?
       ORDER BY u.display_name`,
      [uid, uid, uid]
    );
    res.json({success: true, data: {friends}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to load friends'}});
  }
});

// GET /api/friends/requests — List pending requests (received + sent)
router.get('/requests', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const uid = req.user!.id;
    const received = queryAll(db,
      `SELECT fr.id, fr.created_at, u.id as from_user_id, u.username, u.display_name, u.avatar_url
       FROM friend_requests fr JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = ? AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [uid]
    );
    const sent = queryAll(db,
      `SELECT fr.id, fr.created_at, u.id as to_user_id, u.username, u.display_name, u.avatar_url
       FROM friend_requests fr JOIN users u ON u.id = fr.to_user_id
       WHERE fr.from_user_id = ? AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [uid]
    );
    res.json({success: true, data: {received, sent}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to load requests'}});
  }
});

// GET /api/friends/status/:userId — Check friendship status with a user
router.get('/status/:userId', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const uid = req.user!.id;
    const targetId = req.params.userId;
    const friendship = queryOne(db,
      'SELECT * FROM friendships WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)',
      [uid, targetId, targetId, uid]
    );
    if (friendship) {
      res.json({success: true, data: {status: 'friends'}});
      return;
    }
    const outgoing = queryOne(db,
      "SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'",
      [uid, targetId]
    );
    if (outgoing) {
      res.json({success: true, data: {status: 'request_sent', requestId: (outgoing as any).id}});
      return;
    }
    const incoming = queryOne(db,
      "SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'",
      [targetId, uid]
    );
    if (incoming) {
      res.json({success: true, data: {status: 'request_received', requestId: (incoming as any).id}});
      return;
    }
    res.json({success: true, data: {status: 'none'}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to check status'}});
  }
});

export default router;
