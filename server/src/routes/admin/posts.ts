import {Router, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryAll, queryScalar, runStatement} from '../../db/helpers';
import {authMiddleware, requirePermission, AuthenticatedRequest, logAuditAction} from '../../middleware/auth';
import type {Post} from '../../types';
import {sendToUser, broadcastToAll} from '../../websocket';
import {generateId} from '../../utils/auth';

const router = Router();

router.get('/', authMiddleware, requirePermission('posts.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const {page = '1', pageSize = '20', status = '', search = ''} = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limit = Math.min(100, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    if (status) { where += ' AND p.status = ?'; params.push(status); }
    if (search) { where += ' AND (p.caption LIKE ? OR u.display_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const total = queryScalar(db, `SELECT COUNT(*) as count FROM posts p LEFT JOIN users u ON p.author_id = u.id ${where}`, params) || 0;
    const posts = queryAll(db, `
      SELECT p.*, u.display_name as author_name, u.username as author_username, u.avatar_url as author_avatar
      FROM posts p LEFT JOIN users u ON p.author_id = u.id
      ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({
      success: true,
      data: posts.map((p: any) => ({
        id: p.id, authorId: p.author_id, authorName: p.author_name, authorUsername: p.author_username,
        authorAvatar: p.author_avatar, imageUrl: p.image_url, caption: p.caption,
        likeCount: p.like_count, commentCount: p.comment_count, shareCount: p.share_count,
        status: p.status, createdAt: p.created_at,
      })),
      meta: {page: pageNum, pageSize: limit, total, hasMore: offset + limit < total},
    });
  } catch (error) {
    console.error('List posts error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to list posts'}});
  }
});

router.get('/:id', authMiddleware, requirePermission('posts.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const post = queryOne(db, `
      SELECT p.*, u.display_name as author_name, u.username as author_username, u.avatar_url as author_avatar
      FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = ?
    `, [req.params.id]) as any;

    if (!post) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Post not found'}});
      return;
    }

    const comments = queryAll(db, `
      SELECT pc.*, u.display_name as author_name, u.username as author_username
      FROM post_comments pc LEFT JOIN users u ON pc.author_id = u.id
      WHERE pc.post_id = ? AND pc.status = 'active' ORDER BY pc.created_at DESC LIMIT 50
    `, [post.id]);

    res.json({
      success: true,
      data: {
        id: post.id, authorId: post.author_id, authorName: post.author_name, authorUsername: post.author_username,
        authorAvatar: post.author_avatar, imageUrl: post.image_url, caption: post.caption,
        likeCount: post.like_count, commentCount: post.comment_count, shareCount: post.share_count,
        status: post.status, createdAt: post.created_at,
        comments: comments.map((c: any) => ({id: c.id, authorName: c.author_name, authorUsername: c.author_username, content: c.content, createdAt: c.created_at})),
      },
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get post'}});
  }
});

router.put('/:id/status', authMiddleware, requirePermission('posts.moderate'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {status} = req.body;
    if (!['active', 'pending', 'rejected', 'hidden', 'deleted'].includes(status)) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'Invalid status'}});
      return;
    }

    const db = await getDb();
    const post = queryOne(db, 'SELECT * FROM posts WHERE id = ?', [req.params.id]) as Post | undefined;
    if (!post) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Post not found'}});
      return;
    }

    const updatedAt = Date.now();
    runStatement(db, 'UPDATE posts SET status = ?, updated_at = ? WHERE id = ?', [status, updatedAt, req.params.id]);
    saveDb();
    logAuditAction(db, req.admin!.id, `post.${status}`, 'post', post.id, (post as any).caption || 'No caption');
    const notificationType = status === 'active' ? 'post_approved' : status === 'rejected' ? 'post_rejected' : null;
    if (notificationType) {
      const notificationId = generateId();
      const title = status === 'active' ? 'Post approved' : 'Post rejected';
      const body = status === 'active'
        ? 'Your post is now visible in the social feed.'
        : 'Your post was rejected by an administrator.';
      runStatement(db,
        'INSERT INTO notifications (id, user_id, type, title, body, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [notificationId, (post as any).author_id, notificationType, title, body, JSON.stringify({postId: post.id}), updatedAt]
      );
      sendToUser((post as any).author_id, {
        type: 'notification',
        notification: {id: notificationId, type: notificationType, title, body, createdAt: updatedAt},
      });
    }
    broadcastToAll({type: 'post_updated', postId: post.id, status});
    res.json({success: true, data: {message: `Post ${status}`}});
  } catch (error) {
    console.error('Update post status error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to update post status'}});
  }
});

export default router;
