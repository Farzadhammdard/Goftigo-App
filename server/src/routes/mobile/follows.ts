import {Router, Response} from 'express';
import {getDb} from '../../db/connection';
import {queryOne, queryAll, queryScalar, runStatement} from '../../db/helpers';
import {generateId, now} from '../../utils/auth';
import {mobileAuthMiddleware, MobileAuthRequest} from '../../middleware/mobileAuth';
import {sendToUser} from '../../websocket';

const router = Router();

// POST /api/follows/:id/follow
router.post('/:id/follow', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const followerId = req.user!.id;
    const followingId = req.params.id;
    if (followerId === followingId) {
      res.status(400).json({success: false, error: {code: 'SELF_FOLLOW', message: 'Cannot follow yourself'}});
      return;
    }
    const target = queryOne(db, 'SELECT id FROM users WHERE id = ? AND status = ?', [followingId, 'active']);
    if (!target) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'User not found'}});
      return;
    }
    const existing = queryOne(db, 'SELECT * FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
    if (existing) {
      res.json({success: true, data: {following: true}});
      return;
    }
    const ts = now();
    runStatement(db, 'INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)', [followerId, followingId, ts]);
    // Notification
    const me = queryOne(db, 'SELECT display_name FROM users WHERE id = ?', [followerId]) as any;
    const notifId = generateId();
    runStatement(db, 'INSERT INTO notifications (id, user_id, type, title, body, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [notifId, followingId, 'new_follower', 'New follower', `${me.display_name} started following you`, JSON.stringify({followerId}), ts]);
    sendToUser(followingId, {type: 'notification', notification: {id: notifId, type: 'new_follower', title: 'New follower', body: `${me.display_name} started following you`, createdAt: ts}});
    res.json({success: true, data: {following: true}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to follow'}});
  }
});

// DELETE /api/users/:id/follow
router.delete('/:id/follow', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    runStatement(db, 'DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [req.user!.id, req.params.id]);
    res.json({success: true, data: {following: false}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to unfollow'}});
  }
});

// GET /api/users/:id/followers
router.get('/:id/followers', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const {page = '1', pageSize = '30'} = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);
    const followers = queryAll(db,
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online, u.last_seen_at,
        (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
       FROM follows f INNER JOIN users u ON f.follower_id = u.id
       WHERE f.following_id = ? ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
      [req.user!.id, req.params.id, limit, offset]
    );
    const total = queryScalar(db, 'SELECT COUNT(*) FROM follows WHERE following_id = ?', [req.params.id]);
    res.json({success: true, data: {followers: followers.map((f: any) => ({...f, isFollowing: !!f.is_following})), total}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get followers'}});
  }
});

// GET /api/users/:id/following
router.get('/:id/following', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const {page = '1', pageSize = '30'} = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);
    const following = queryAll(db,
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online, u.last_seen_at,
        (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id) as is_following
       FROM follows f INNER JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = ? ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
      [req.user!.id, req.params.id, limit, offset]
    );
    const total = queryScalar(db, 'SELECT COUNT(*) FROM follows WHERE follower_id = ?', [req.params.id]);
    res.json({success: true, data: {following: following.map((f: any) => ({...f, isFollowing: !!f.is_following})), total}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get following'}});
  }
});

export default router;
