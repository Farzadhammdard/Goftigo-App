import {Router, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryAll, queryScalar, runStatement} from '../../db/helpers';
import {now} from '../../utils/auth';
import {mobileAuthMiddleware, MobileAuthRequest} from '../../middleware/mobileAuth';
import type {User} from '../../types';

const router = Router();

// GET /api/users/search
router.get('/search', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {q, page = '1', pageSize = '20'} = req.query;
    const db = await getDb();
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);
    let users;
    if (q && (q as string).trim()) {
      const query = `%${(q as string).trim()}%`;
      users = queryAll(db,
        'SELECT id, public_user_id, username, display_name, avatar_url, bio, is_online FROM users WHERE (username LIKE ? OR display_name LIKE ? OR phone_number LIKE ? OR public_user_id LIKE ?) AND status = ? AND id != ? LIMIT ? OFFSET ?',
        [query, query, query, query, 'active', req.user!.id, limit, offset]
      );
    } else {
      users = queryAll(db,
        'SELECT id, public_user_id, username, display_name, avatar_url, bio, is_online FROM users WHERE status = ? AND id != ? LIMIT ? OFFSET ?',
        ['active', req.user!.id, limit, offset]
      );
    }
    const total = q && (q as string).trim()
      ? queryScalar(db, 'SELECT COUNT(*) FROM users WHERE (username LIKE ? OR display_name LIKE ? OR phone_number LIKE ? OR public_user_id LIKE ?) AND status = ? AND id != ?',
          [`%${(q as string).trim()}%`, `%${(q as string).trim()}%`, `%${(q as string).trim()}%`, `%${(q as string).trim()}%`, 'active', req.user!.id])
      : queryScalar(db, 'SELECT COUNT(*) FROM users WHERE status = ? AND id != ?', ['active', req.user!.id]);
    res.json({success: true, data: {users, pagination: {page: parseInt(page as string), pageSize: limit, total, totalPages: Math.ceil(total / limit)}}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to search users'}});
  }
});

// PUT /api/users/profile
router.put('/profile', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {displayName, bio, avatarUrl, username} = req.body;
    const db = await getDb();
    const ts = now();
    // Check username uniqueness if changing
    if (username) {
      const existing = queryOne(db, 'SELECT id FROM users WHERE username = ? AND id != ?', [username, req.user!.id]);
      if (existing) {
        res.status(409).json({success: false, error: {code: 'USERNAME_TAKEN', message: 'Username is already taken'}});
        return;
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        res.status(400).json({success: false, error: {code: 'INVALID_USERNAME', message: 'Username must be 3-20 chars, alphanumeric/underscore'}});
        return;
      }
    }
    runStatement(db,
      `UPDATE users SET display_name = COALESCE(?, display_name), bio = COALESCE(?, bio), avatar_url = COALESCE(?, avatar_url),
       username = COALESCE(?, username), updated_at = ? WHERE id = ?`,
      [displayName || null, bio || null, avatarUrl || null, username || null, ts, req.user!.id]
    );
    saveDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.user!.id]) as User;
    res.json({success: true, data: {
      id: user.id, phoneNumber: user.phone_number, username: user.username, displayName: user.display_name,
      avatarUrl: user.avatar_url, bio: user.bio, publicUserId: user.public_user_id,
    }});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to update profile'}});
  }
});

// GET /api/users/:id — Full profile with real stats
router.get('/:id', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const user = queryOne(db,
      'SELECT id, public_user_id, username, display_name, avatar_url, profile_photo, bio, is_verified, is_online, last_seen_at, last_active, created_at FROM users WHERE id = ? AND status = ?',
      [req.params.id, 'active']
    ) as any;
    if (!user) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'User not found'}});
      return;
    }
    const postCount = queryScalar(db, "SELECT COUNT(*) FROM posts WHERE author_id = ? AND status = 'active'", [user.id]) || 0;
    const friendsCount = queryScalar(db,
      'SELECT COUNT(*) FROM friendships WHERE user_id_1 = ? OR user_id_2 = ?', [user.id, user.id]) || 0;
    const followersCount = queryScalar(db, 'SELECT COUNT(*) FROM follows WHERE following_id = ?', [user.id]) || 0;
    const followingCount = queryScalar(db, 'SELECT COUNT(*) FROM follows WHERE follower_id = ?', [user.id]) || 0;
    const isFollowing = !!queryOne(db, 'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', [req.user!.id, user.id]);
    const isFriend = !!queryOne(db,
      'SELECT 1 FROM friendships WHERE (user_id_1 = ? AND user_id_2 = ?) OR (user_id_1 = ? AND user_id_2 = ?)',
      [req.user!.id, user.id, user.id, req.user!.id]);
    res.json({success: true, data: {
      ...user, postCount, friendsCount, followersCount, followingCount, isFollowing, isFriend,
    }});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get user'}});
  }
});

export default router;
