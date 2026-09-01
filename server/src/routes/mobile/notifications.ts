import {Router, Response} from 'express';
import {getDb} from '../../db/connection';
import {queryAll, queryScalar, runStatement} from '../../db/helpers';
import {mobileAuthMiddleware, MobileAuthRequest} from '../../middleware/mobileAuth';

const router = Router();

// GET /api/notifications — List notifications
router.get('/', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {page = '1', pageSize = '30'} = req.query;
    const db = await getDb();
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);
    const notifications = queryAll(db,
      'SELECT id, type, title, body, data, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user!.id, limit, offset]
    );
    const unread = queryScalar(db, 'SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0', [req.user!.id]);
    const total = queryScalar(db, 'SELECT COUNT(*) FROM notifications WHERE user_id = ?', [req.user!.id]);
    res.json({success: true, data: {notifications, unread, total}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to load notifications'}});
  }
});

// POST /api/notifications/:id/read — Mark as read
router.post('/:id/read', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    runStatement(db, 'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id]);
    res.json({success: true});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}});
  }
});

// POST /api/notifications/read-all — Mark all as read
router.post('/read-all', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    runStatement(db, 'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user!.id]);
    res.json({success: true});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}});
  }
});

export default router;
