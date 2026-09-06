import {Router, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryAll, runStatement} from '../../db/helpers';
import {generateId, now} from '../../utils/auth';
import {mobileAuthMiddleware, MobileAuthRequest} from '../../middleware/mobileAuth';

const router = Router();

const VALID_CATEGORIES = ['privacy', 'notifications', 'chat', 'media', 'appearance', 'language', 'nearby', 'security'];

function getDefaultSettings(): Record<string, any> {
  return {
    privacy: {
      whoCanSeePhone: 'friends', whoCanFindByPhone: 'everyone', whoCanMessage: 'everyone',
      whoCanSendFriendRequest: 'everyone', whoCanSeeProfile: 'everyone', whoCanSeeProfilePhoto: 'everyone',
      whoCanSeeBio: 'everyone', whoCanSeeOnlineStatus: 'everyone', whoCanSeeLastSeen: 'everyone',
      readReceipts: true, typingIndicator: true,
    },
    notifications: {
      messages: true, friendRequests: true, friendRequestAccepted: true, likes: true, comments: true,
      followers: true, mentions: true, adminMessages: true, postApproval: true, postRejection: true,
      systemNotifications: true, sound: true, vibration: true, notificationPreview: true, badgeCount: true,
    },
    chat: {enterKeySends: false, messagePreview: true, readReceipts: true, typingIndicator: true, fontSize: 'medium', autoDownloadMedia: true},
    media: {autoDownloadPhotos: 'wifi', autoDownloadVideos: 'wifi', autoDownloadFiles: 'wifi', autoDownloadVoice: 'wifi', dataSaver: false},
    appearance: {theme: 'system', fontSize: 'medium'},
    language: {code: 'en'},
    nearby: {discoveryEnabled: true, whoCanDiscover: 'everyone'},
    security: {loginAlerts: true, twoFactorEnabled: false},
  };
}

function getUserSettings(db: any, userId: string): Record<string, any> {
  const rows = queryAll(db, 'SELECT category, settings_json FROM user_settings WHERE user_id = ?', [userId]);
  const settings: Record<string, any> = {};
  for (const row of rows) { settings[row.category] = JSON.parse(row.settings_json); }
  const defaults = getDefaultSettings();
  for (const [cat, defs] of Object.entries(defaults)) { if (!settings[cat]) settings[cat] = defs; }
  return settings;
}

// GET / — All settings
router.get('/', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const settings = getUserSettings(await getDb(), req.user!.id);
    res.json({success: true, data: settings});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get settings'}}); }
});

// ============ BLOCKED USERS ============
router.get('/blocked', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const blocked = queryAll(await getDb(),
      `SELECT bu.blocked_id, bu.created_at, u.username, u.display_name, u.avatar_url FROM blocked_users bu INNER JOIN users u ON bu.blocked_id = u.id WHERE bu.blocker_id = ?`,
      [req.user!.id]);
    res.json({success: true, data: {blocked}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.post('/blocked', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {userId} = req.body;
    if (!userId) { res.status(400).json({success: false, error: {code: 'MISSING_FIELDS', message: 'userId required'}}); return; }
    if (userId === req.user!.id) { res.status(400).json({success: false, error: {code: 'INVALID', message: 'Cannot block yourself'}}); return; }
    const db = await getDb();
    const target = queryOne(db, 'SELECT id FROM users WHERE id = ?', [userId]);
    if (!target) { res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'User not found'}}); return; }
    const existing = queryOne(db, 'SELECT blocker_id FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', [req.user!.id, userId]);
    if (!existing) { runStatement(db, 'INSERT INTO blocked_users (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', [req.user!.id, userId, now()]); saveDb(); }
    res.json({success: true, data: {message: 'User blocked'}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.delete('/blocked/:id', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    runStatement(await getDb(), 'DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', [req.user!.id, req.params.id]);
    saveDb();
    res.json({success: true, data: {message: 'User unblocked'}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

// ============ SESSIONS ============
router.get('/sessions', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const sessions = queryAll(await getDb(), 'SELECT id, device_type, os_version, app_version, device_name, is_active, last_active_at, created_at FROM user_devices WHERE user_id = ?', [req.user!.id]);
    res.json({success: true, data: {sessions}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.delete('/sessions/all', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    runStatement(await getDb(), 'UPDATE user_devices SET is_active = 0 WHERE user_id = ? AND is_active = 1', [req.user!.id]);
    saveDb();
    res.json({success: true, data: {message: 'All sessions logged out'}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.delete('/sessions/:id', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const device = queryOne(db, 'SELECT id FROM user_devices WHERE id = ? AND user_id = ?', [req.params.id, req.user!.id]);
    if (!device) { res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Session not found'}}); return; }
    runStatement(db, 'UPDATE user_devices SET is_active = 0 WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({success: true, data: {message: 'Session logged out'}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

// ============ ACCOUNT ROUTES (before /:category!) ============
router.post('/change-password', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {currentPassword, newPassword} = req.body;
    if (!currentPassword || !newPassword) { res.status(400).json({success: false, error: {code: 'MISSING_FIELDS', message: 'Current and new password required'}}); return; }
    if (newPassword.length < 4) { res.status(400).json({success: false, error: {code: 'WEAK_PASSWORD', message: 'Password must be at least 4 characters'}}); return; }
    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.user!.id]) as any;
    const {comparePassword, hashPassword} = await import('../../utils/auth');
    const valid = await comparePassword(currentPassword, user.password_hash);
    if (!valid) { res.status(401).json({success: false, error: {code: 'INVALID_PASSWORD', message: 'Current password is incorrect'}}); return; }
    const hash = await hashPassword(newPassword);
    runStatement(db, 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hash, now(), req.user!.id]);
    saveDb();
    res.json({success: true, data: {message: 'Password changed successfully'}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.put('/username', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {username} = req.body;
    if (!username) { res.status(400).json({success: false, error: {code: 'MISSING_FIELDS', message: 'Username required'}}); return; }
    if (username.length < 3 || username.length > 20) { res.status(400).json({success: false, error: {code: 'INVALID_USERNAME', message: 'Username must be 3-20 characters'}}); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { res.status(400).json({success: false, error: {code: 'INVALID_USERNAME', message: 'Username must be alphanumeric or underscore'}}); return; }
    const db = await getDb();
    const existing = queryOne(db, 'SELECT id FROM users WHERE username = ? AND id != ?', [username, req.user!.id]);
    if (existing) { res.status(409).json({success: false, error: {code: 'USERNAME_TAKEN', message: 'Username already taken'}}); return; }
    runStatement(db, 'UPDATE users SET username = ?, updated_at = ? WHERE id = ?', [username, now(), req.user!.id]);
    saveDb();
    res.json({success: true, data: {username}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.put('/phone', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {phoneNumber} = req.body;
    if (!phoneNumber) { res.status(400).json({success: false, error: {code: 'MISSING_FIELDS', message: 'Phone number required'}}); return; }
    const db = await getDb();
    const existing = queryOne(db, 'SELECT id FROM users WHERE phone_number = ? AND id != ?', [phoneNumber, req.user!.id]);
    if (existing) { res.status(409).json({success: false, error: {code: 'PHONE_TAKEN', message: 'Phone number already in use'}}); return; }
    runStatement(db, 'UPDATE users SET phone_number = ?, updated_at = ? WHERE id = ?', [phoneNumber, now(), req.user!.id]);
    saveDb();
    res.json({success: true, data: {phoneNumber}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.post('/deactivate', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    runStatement(db, 'UPDATE users SET status = ?, updated_at = ? WHERE id = ?', ['suspended', now(), req.user!.id]);
    runStatement(db, 'UPDATE user_devices SET is_active = 0 WHERE user_id = ?', [req.user!.id]);
    saveDb();
    res.json({success: true, data: {message: 'Account deactivated'}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.post('/delete', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    runStatement(db, 'UPDATE users SET status = ?, updated_at = ? WHERE id = ?', ['deleted', now(), req.user!.id]);
    runStatement(db, 'UPDATE user_devices SET is_active = 0 WHERE user_id = ?', [req.user!.id]);
    saveDb();
    res.json({success: true, data: {message: 'Account scheduled for deletion'}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.get('/export', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const userId = req.user!.id;
    const user = queryOne(db, 'SELECT id, public_user_id, phone_number, username, display_name, avatar_url, bio, status, is_verified, created_at FROM users WHERE id = ?', [userId]);
    const settings = getUserSettings(db, userId);
    const blocked = queryAll(db, 'SELECT blocked_id, created_at FROM blocked_users WHERE blocker_id = ?', [userId]);
    const devices = queryAll(db, 'SELECT id, device_type, device_name, is_active, last_active_at FROM user_devices WHERE user_id = ?', [userId]);
    const posts = queryAll(db, 'SELECT id, caption, like_count, comment_count, created_at FROM posts WHERE author_id = ?', [userId]);
    const friends = queryAll(db, `SELECT CASE WHEN user_id_1 = ? THEN user_id_2 ELSE user_id_1 END as friend_id, created_at FROM friendships WHERE user_id_1 = ? OR user_id_2 = ?`, [userId, userId, userId]);
    res.json({success: true, data: {user, settings, blocked, devices, posts, friends, exportedAt: now()}});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

// ============ CATEGORY ROUTES (catch-all LAST) ============
router.get('/:category', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {category} = req.params;
    if (!VALID_CATEGORIES.includes(category)) { res.status(400).json({success: false, error: {code: 'INVALID_CATEGORY', message: 'Invalid settings category'}}); return; }
    const settings = getUserSettings(await getDb(), req.user!.id);
    res.json({success: true, data: settings[category]});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.put('/:category', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {category} = req.params;
    if (!VALID_CATEGORIES.includes(category)) { res.status(400).json({success: false, error: {code: 'INVALID_CATEGORY', message: 'Invalid settings category'}}); return; }
    const db = await getDb();
    const ts = now();
    const existing = queryOne(db, 'SELECT settings_json, created_at FROM user_settings WHERE user_id = ? AND category = ?', [req.user!.id, category]);
    const current = existing ? JSON.parse(existing.settings_json) : {};
    const merged = {...current, ...req.body};
    runStatement(db, 'INSERT OR REPLACE INTO user_settings (user_id, category, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [req.user!.id, category, JSON.stringify(merged), existing ? existing.created_at : ts, ts]);
    saveDb();
    res.json({success: true, data: merged});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

router.delete('/:category', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {category} = req.params;
    if (!VALID_CATEGORIES.includes(category)) { res.status(400).json({success: false, error: {code: 'INVALID_CATEGORY', message: 'Invalid settings category'}}); return; }
    const db = await getDb();
    const ts = now();
    const defaults = getDefaultSettings();
    runStatement(db, 'INSERT OR REPLACE INTO user_settings (user_id, category, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [req.user!.id, category, JSON.stringify(defaults[category]), ts, ts]);
    saveDb();
    res.json({success: true, data: defaults[category]});
  } catch { res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed'}}); }
});

export default router;
