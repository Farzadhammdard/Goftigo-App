import {Router, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryAll, queryScalar, runStatement} from '../../db/helpers';
import {authMiddleware, requirePermission, AuthenticatedRequest, logAuditAction} from '../../middleware/auth';
import {generateId, now} from '../../utils/auth';

const router = Router();

router.get('/health', authMiddleware, requirePermission('communication.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const dbOk = !!queryScalar(db, 'SELECT 1 as v');
    const checks = [
      {name: 'Backend API', status: 'ok', message: 'API server running'},
      {name: 'Database', status: dbOk ? 'ok' : 'error', message: dbOk ? 'Connected' : 'Failed'},
      {name: 'Authentication', status: 'ok', message: 'JWT operational'},
      {name: 'WebSocket', status: 'warning', message: 'Not implemented'},
      {name: 'File Storage', status: 'ok', message: 'Local filesystem'},
      {name: 'Notifications', status: 'warning', message: 'Not implemented'},
      {name: 'P2P Monitoring', status: 'warning', message: 'Not implemented'},
      {name: 'Queue', status: 'ok', message: 'Synchronous'},
    ];
    res.json({success: true, data: {checks, overallStatus: checks.every(c => c.status === 'ok') ? 'healthy' : 'partial'}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Health check failed'}});
  }
});

router.get('/settings', authMiddleware, requirePermission('settings.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const settings = queryAll(db, 'SELECT * FROM system_settings ORDER BY key');
    res.json({
      success: true,
      data: settings.map((s: any) => ({key: s.key, value: s.value, description: s.description, updatedAt: s.updated_at})),
    });
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get settings'}});
  }
});

router.put('/settings', authMiddleware, requirePermission('settings.write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const {settings} = req.body;
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'Settings object required'}});
      return;
    }

    const ts = now();
    for (const [key, value] of Object.entries(settings)) {
      const existing = queryOne(db, 'SELECT key FROM system_settings WHERE key = ?', [key]);
      if (existing) {
        runStatement(db, 'UPDATE system_settings SET value = ?, updated_by = ?, updated_at = ? WHERE key = ?', [String(value), req.admin!.id, ts, key]);
      } else {
        runStatement(db, 'INSERT INTO system_settings (key, value, description, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)', [key, String(value), null, req.admin!.id, ts]);
      }
    }
    saveDb();

    logAuditAction(db, req.admin!.id, 'settings.updated', 'setting', undefined, undefined, {keys: Object.keys(settings)});
    res.json({success: true, data: {message: 'Settings updated'}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to update settings'}});
  }
});

router.get('/announcements', authMiddleware, requirePermission('announcements.manage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const announcements = queryAll(db, `
      SELECT a.*, ad.display_name as creator_name
      FROM announcements a LEFT JOIN admin_users ad ON a.created_by = ad.id ORDER BY a.created_at DESC
    `);
    res.json({
      success: true,
      data: announcements.map((a: any) => ({
        id: a.id, title: a.title, message: a.message, target: a.target,
        targetIds: a.target_ids ? JSON.parse(a.target_ids) : null, isActive: a.is_active,
        createdBy: a.created_by, creatorName: a.creator_name, createdAt: a.created_at, expiresAt: a.expires_at,
      })),
    });
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to list announcements'}});
  }
});

router.post('/announcements', authMiddleware, requirePermission('announcements.manage'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {title, message, target = 'all', targetIds, expiresAt} = req.body;
    if (!title || !message) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'Title and message required'}});
      return;
    }

    const db = await getDb();
    const id = generateId();
    const ts = now();
    runStatement(db, 'INSERT INTO announcements (id, title, message, target, target_ids, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, message, target, targetIds ? JSON.stringify(targetIds) : null, req.admin!.id, ts, expiresAt || null]);
    saveDb();

    logAuditAction(db, req.admin!.id, 'announcement.created', 'announcement', id, title);
    res.status(201).json({success: true, data: {id, title, createdAt: ts}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to create announcement'}});
  }
});

router.get('/audit-log', authMiddleware, requirePermission('audit.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const {page = '1', pageSize = '50'} = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limit = Math.min(200, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * limit;

    const total = queryScalar(db, 'SELECT COUNT(*) as count FROM audit_log') || 0;
    const logs = queryAll(db, `
      SELECT al.*, ad.display_name as admin_name, ad.username as admin_username
      FROM audit_log al LEFT JOIN admin_users ad ON al.admin_id = ad.id
      ORDER BY al.created_at DESC LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({
      success: true,
      data: logs.map((l: any) => ({
        id: l.id, adminId: l.admin_id, adminName: l.admin_name, adminUsername: l.admin_username,
        action: l.action, targetType: l.target_type, targetId: l.target_id, targetName: l.target_name,
        metadata: l.metadata ? JSON.parse(l.metadata) : null, result: l.result, createdAt: l.created_at,
      })),
      meta: {page: pageNum, pageSize: limit, total, hasMore: offset + limit < total},
    });
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to list audit log'}});
  }
});

router.get('/online-users', authMiddleware, requirePermission('communication.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const onlineUsers = queryAll(db, 'SELECT id, username, display_name, avatar_url, last_seen_at FROM users WHERE is_online = 1');
    res.json({
      success: true,
      data: onlineUsers.map((u: any) => ({id: u.id, username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url, lastSeenAt: u.last_seen_at})),
    });
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get online users'}});
  }
});

router.get('/nearby-sessions', authMiddleware, requirePermission('communication.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const sessions = queryAll(db, `
      SELECT ns.*, u.display_name, u.username FROM nearby_sessions ns LEFT JOIN users u ON ns.user_id = u.id
      ORDER BY ns.created_at DESC LIMIT 100
    `);
    const activeCount = queryScalar(db, "SELECT COUNT(*) as count FROM nearby_sessions WHERE status = 'active'") || 0;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const totalToday = queryScalar(db, 'SELECT COUNT(*) as count FROM nearby_sessions WHERE created_at >= ?', [todayStart.getTime()]) || 0;

    res.json({
      success: true,
      data: {
        active: activeCount, totalToday,
        sessions: sessions.map((s: any) => ({
          id: s.id, userId: s.user_id, displayName: s.display_name, username: s.username,
          deviceId: s.device_id, status: s.status, connectionType: s.connection_type,
          connectedAt: s.connected_at, disconnectedAt: s.disconnected_at, createdAt: s.created_at,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get nearby sessions'}});
  }
});

export default router;
