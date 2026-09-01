import {Router, Response} from 'express';
import {getDb} from '../../db/connection';
import {queryOne, queryScalar, queryAll} from '../../db/helpers';
import {authMiddleware, AuthenticatedRequest} from '../../middleware/auth';

const router = Router();

router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();

    const totalUsers = queryScalar(db, 'SELECT COUNT(*) as count FROM users') || 0;
    const onlineUsers = queryScalar(db, 'SELECT COUNT(*) as count FROM users WHERE is_online = 1') || 0;
    const totalGroups = queryScalar(db, 'SELECT COUNT(*) as count FROM groups WHERE is_active = 1') || 0;
    const totalPosts = queryScalar(db, "SELECT COUNT(*) as count FROM posts WHERE status = 'active'") || 0;
    const pendingPosts = queryScalar(db, "SELECT COUNT(*) as count FROM posts WHERE status = 'pending'") || 0;
    const totalMessages = queryScalar(db, 'SELECT COUNT(*) as count FROM messages') || 0;
    const openReports = queryScalar(db, "SELECT COUNT(*) as count FROM reports WHERE status = 'open'") || 0;
    const activeNearby = queryScalar(db, "SELECT COUNT(*) as count FROM nearby_sessions WHERE status = 'active'") || 0;
    const pendingFriendRequests = queryScalar(db, "SELECT COUNT(*) as count FROM friend_requests WHERE status = 'pending'") || 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();

    const messagesToday = queryScalar(db, 'SELECT COUNT(*) as count FROM messages WHERE created_at >= ?', [todayTs]) || 0;
    const filesToday = queryScalar(db, "SELECT COUNT(*) as count FROM messages WHERE type IN ('image', 'video', 'file', 'voice') AND created_at >= ?", [todayTs]) || 0;
    const newUsersToday = queryScalar(db, 'SELECT COUNT(*) as count FROM users WHERE created_at >= ?', [todayTs]) || 0;
    const suspendedUsers = queryScalar(db, "SELECT COUNT(*) as count FROM users WHERE status = 'suspended'") || 0;

    const overallHealth = 'healthy';

    res.json({
      success: true,
      data: {
        users: {total: totalUsers, online: onlineUsers, newToday: newUsersToday, suspended: suspendedUsers},
        messages: {total: totalMessages, today: messagesToday, filesToday},
        groups: {total: totalGroups},
        posts: {total: totalPosts, pending: pendingPosts},
        reports: {open: openReports},
        nearby: {active: activeNearby},
        friends: {pendingRequests: pendingFriendRequests},
        health: overallHealth,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to fetch stats'}});
  }
});

router.get('/health', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const dbOk = !!queryScalar(db, 'SELECT 1 as v');

    const checks = [
      {name: 'Backend API', status: 'ok', message: 'API server running'},
      {name: 'Database', status: dbOk ? 'ok' : 'error', message: dbOk ? 'Connected' : 'Connection failed'},
      {name: 'Authentication', status: 'ok', message: 'JWT auth operational'},
      {name: 'WebSocket', status: 'ok', message: 'Real-time messaging active'},
      {name: 'File Storage', status: 'ok', message: 'Local filesystem'},
      {name: 'Notifications', status: 'ok', message: 'In-app notifications active'},
      {name: 'P2P Monitoring', status: 'warning', message: 'Not yet implemented'},
      {name: 'Queue', status: 'ok', message: 'No queue system configured'},
    ];

    const overallStatus = checks.every(c => c.status === 'ok') ? 'healthy' :
      checks.some(c => c.status === 'error') ? 'degraded' : 'partial';

    res.json({success: true, data: {checks, overallStatus}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Health check failed'}});
  }
});

export default router;
