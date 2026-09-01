import {Router, Response} from 'express';
import {getDb} from '../../db/connection';
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

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page as string),
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to search users'}});
  }
});

// GET /api/users/:id
router.get('/:id', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const user = queryOne(db,
      'SELECT id, username, display_name, avatar_url, bio, created_at FROM users WHERE id = ? AND status = ?',
      [req.params.id, 'active']
    ) as User | undefined;

    if (!user) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'User not found'}});
      return;
    }

    const postCount = queryScalar(db, 'SELECT COUNT(*) FROM posts WHERE author_id = ? AND status = ?', [user.id, 'active']);
    const followerCount = queryScalar(db, 'SELECT COUNT(*) FROM conversation_participants WHERE user_id = ?', [user.id]) || 0;

    res.json({
      success: true,
      data: {
        ...user,
        postCount,
        followerCount,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get user'}});
  }
});

// PUT /api/users/profile
router.put('/profile', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {displayName, bio, avatarUrl} = req.body;
    const db = await getDb();
    const ts = Date.now();

    runStatement(db,
      'UPDATE users SET display_name = COALESCE(?, display_name), bio = COALESCE(?, bio), avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?',
      [displayName || null, bio || null, avatarUrl || null, ts, req.user!.id]
    );

    const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.user!.id]) as User;

    res.json({
      success: true,
      data: {
        id: user.id,
        phoneNumber: user.phone_number,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to update profile'}});
  }
});

export default router;
