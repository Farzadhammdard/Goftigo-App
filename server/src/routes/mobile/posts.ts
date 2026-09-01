import {Router, Response} from 'express';
import {getDb} from '../../db/connection';
import {queryOne, queryAll, queryScalar, runStatement} from '../../db/helpers';
import {generateId, now} from '../../utils/auth';
import {mobileAuthMiddleware, MobileAuthRequest} from '../../middleware/mobileAuth';

const router = Router();

// GET /api/posts/feed
router.get('/feed', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const {page = '1', pageSize = '20'} = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    const posts = queryAll(db,
      `SELECT p.*, u.username as author_username, u.display_name as author_name, u.avatar_url as author_avatar,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id AND status = 'active') as comment_count,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked,
        (SELECT COUNT(*) FROM post_saves WHERE post_id = p.id AND user_id = ?) as is_saved
       FROM posts p
       INNER JOIN users u ON p.author_id = u.id
       WHERE p.status = 'active'
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user!.id, req.user!.id, limit, offset]
    );

    const total = queryScalar(db, "SELECT COUNT(*) FROM posts WHERE status = 'active'");

    res.json({
      success: true,
      data: {
        posts: posts.map((p: any) => ({
          ...p,
          isLiked: !!p.is_liked,
          isSaved: !!p.is_saved,
        })),
        pagination: {
          page: parseInt(page as string),
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get feed'}});
  }
});

// POST /api/posts
router.post('/', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {imageUrl, caption} = req.body;
    const db = await getDb();
    const userId = req.user!.id;
    const ts = now();

    if (!imageUrl && !caption) {
      res.status(400).json({success: false, error: {code: 'EMPTY_POST', message: 'Provide imageUrl or caption'}});
      return;
    }

    const postId = generateId();
    runStatement(db,
      'INSERT INTO posts (id, author_id, image_url, caption, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [postId, userId, imageUrl || null, caption || null, 'pending', ts, ts]
    );

    const post = queryOne(db,
      `SELECT p.*, u.username as author_username, u.display_name as author_name, u.avatar_url as author_avatar
       FROM posts p INNER JOIN users u ON p.author_id = u.id WHERE p.id = ?`,
      [postId]
    );

    res.json({success: true, data: {post}});
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to create post'}});
  }
});

// POST /api/posts/:id/like
router.post('/:id/like', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.id;

    const post = queryOne(db, 'SELECT id FROM posts WHERE id = ? AND status = ?', [req.params.id, 'active']);
    if (!post) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Post not found'}});
      return;
    }

    const existing = queryOne(db,
      'SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?',
      [req.params.id, userId]
    );

    if (existing) {
      runStatement(db, 'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.id, userId]);
      runStatement(db, 'UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?', [req.params.id]);
      res.json({success: true, data: {liked: false}});
    } else {
      runStatement(db, 'INSERT INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)', [req.params.id, userId, now()]);
      runStatement(db, 'UPDATE posts SET like_count = like_count + 1 WHERE id = ?', [req.params.id]);
      res.json({success: true, data: {liked: true}});
    }
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to toggle like'}});
  }
});

// POST /api/posts/:id/save
router.post('/:id/save', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.id;

    const post = queryOne(db, 'SELECT id FROM posts WHERE id = ?', [req.params.id]);
    if (!post) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Post not found'}});
      return;
    }

    const existing = queryOne(db,
      'SELECT * FROM post_saves WHERE post_id = ? AND user_id = ?',
      [req.params.id, userId]
    );

    if (existing) {
      runStatement(db, 'DELETE FROM post_saves WHERE post_id = ? AND user_id = ?', [req.params.id, userId]);
      res.json({success: true, data: {saved: false}});
    } else {
      runStatement(db, 'INSERT INTO post_saves (post_id, user_id, created_at) VALUES (?, ?, ?)', [req.params.id, userId, now()]);
      res.json({success: true, data: {saved: true}});
    }
  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to toggle save'}});
  }
});

// GET /api/posts/:id
router.get('/:id', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();

    const post = queryOne(db,
      `SELECT p.*, u.username as author_username, u.display_name as author_name, u.avatar_url as author_avatar,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id AND status = 'active') as comment_count,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked,
        (SELECT COUNT(*) FROM post_saves WHERE post_id = p.id AND user_id = ?) as is_saved
       FROM posts p
       INNER JOIN users u ON p.author_id = u.id
       WHERE p.id = ?`,
      [req.user!.id, req.user!.id, req.params.id]
    );

    if (!post) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Post not found'}});
      return;
    }

    const comments = queryAll(db,
      `SELECT pc.*, u.username as author_username, u.display_name as author_name, u.avatar_url as author_avatar
       FROM post_comments pc INNER JOIN users u ON pc.author_id = u.id
       WHERE pc.post_id = ? AND pc.status = 'active'
       ORDER BY pc.created_at ASC`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...post,
        isLiked: !!post.is_liked,
        isSaved: !!post.is_saved,
        comments,
      },
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get post'}});
  }
});

// GET /api/posts/my
router.get('/my', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.id;
    const {page = '1', pageSize = '20'} = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    const posts = queryAll(db,
      `SELECT p.*, u.username as author_username, u.display_name as author_name, u.avatar_url as author_avatar,
        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id AND status = 'active') as comment_count
       FROM posts p
       INNER JOIN users u ON p.author_id = u.id
       WHERE p.author_id = ?
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const total = queryScalar(db, 'SELECT COUNT(*) FROM posts WHERE author_id = ?', [userId]);

    res.json({success: true, data: {posts, pagination: {page: parseInt(page as string), pageSize: limit, total, totalPages: Math.ceil(total / limit)}}});
  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get posts'}});
  }
});

// POST /api/posts/:id/comments
router.post('/:id/comments', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {content} = req.body;
    const db = await getDb();
    const userId = req.user!.id;
    const ts = now();

    if (!content) {
      res.status(400).json({success: false, error: {code: 'MISSING_CONTENT', message: 'content required'}});
      return;
    }

    const post = queryOne(db, 'SELECT id FROM posts WHERE id = ? AND status = ?', [req.params.id, 'active']);
    if (!post) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Post not found'}});
      return;
    }

    const commentId = generateId();
    runStatement(db,
      'INSERT INTO post_comments (id, post_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [commentId, req.params.id, userId, content, ts]
    );
    runStatement(db, 'UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?', [req.params.id]);

    const comment = queryOne(db,
      `SELECT pc.*, u.username as author_username, u.display_name as author_name, u.avatar_url as author_avatar
       FROM post_comments pc INNER JOIN users u ON pc.author_id = u.id WHERE pc.id = ?`,
      [commentId]
    );

    res.json({success: true, data: {comment}});
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to add comment'}});
  }
});

export default router;
