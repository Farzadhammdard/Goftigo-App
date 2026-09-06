import {Router, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryAll, queryScalar, runStatement} from '../../db/helpers';
import {authMiddleware, requirePermission, AuthenticatedRequest, logAuditAction} from '../../middleware/auth';
import {generateId, now, hashPassword} from '../../utils/auth';
import type {User} from '../../types';

const router = Router();

router.get('/', authMiddleware, requirePermission('users.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const {page = '1', pageSize = '20', search = '', status = '', sort = 'created_at', order = 'desc'} = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limit = Math.min(100, Math.max(1, parseInt(pageSize as string)));
    const offset = (pageNum - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      where += ' AND (phone_number LIKE ? OR username LIKE ? OR display_name LIKE ? OR id LIKE ? OR employee_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    const total = queryScalar(db, `SELECT COUNT(*) as count FROM users ${where}`, params) || 0;
    const allowedSorts = ['created_at', 'username', 'display_name', 'last_seen_at', 'status'];
    const sortCol = allowedSorts.includes(sort as string) ? sort : 'created_at';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const users = queryAll(db, `SELECT * FROM users ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`, [...params, limit, offset]);

    res.json({
      success: true,
      data: users.map(u => ({
        id: u.id,
        phoneNumber: u.phone_number,
        username: u.username,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        bio: u.bio,
        employeeId: u.employee_id,
        status: u.status,
        isVerified: u.is_verified,
        isOnline: u.is_online,
        lastSeenAt: u.last_seen_at,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })),
      meta: {page: pageNum, pageSize: limit, total, hasMore: offset + limit < total},
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to list users'}});
  }
});

router.get('/:id', authMiddleware, requirePermission('users.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.params.id]) as User | undefined;

    if (!user) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'User not found'}});
      return;
    }

    const devices = queryAll(db, 'SELECT id, device_type, os_version, app_version, device_name, is_active, last_active_at, created_at FROM user_devices WHERE user_id = ?', [user.id]);
    const groupCount = queryScalar(db, 'SELECT COUNT(*) as count FROM group_members WHERE user_id = ?', [user.id]) || 0;
    const postCount = queryScalar(db, 'SELECT COUNT(*) as count FROM posts WHERE author_id = ?', [user.id]) || 0;
    const messageCount = queryScalar(db, 'SELECT COUNT(*) as count FROM messages WHERE sender_id = ?', [user.id]) || 0;

    res.json({
      success: true,
      data: {
        id: user.id,
        phoneNumber: user.phone_number,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        employeeId: user.employee_id,
        status: user.status,
        isVerified: user.is_verified,
        isOnline: user.is_online,
        lastSeenAt: user.last_seen_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        devices: devices.map((d: any) => ({id: d.id, deviceType: d.device_type, osVersion: d.os_version, appVersion: d.app_version, deviceName: d.device_name, isActive: d.is_active, lastActiveAt: d.last_active_at})),
        stats: {groupCount, postCount, messageCount},
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get user'}});
  }
});

router.post('/', authMiddleware, requirePermission('users.write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {phoneNumber, username, displayName, employeeId, password} = req.body;
    if (!phoneNumber || !username || !displayName || !password) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'phoneNumber, username, displayName and password required'}});
      return;
    }
    if (password.length < 4) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'Password must be at least 4 characters'}});
      return;
    }

    const db = await getDb();
    const existing = queryOne(db, 'SELECT id FROM users WHERE phone_number = ? OR username = ?', [phoneNumber, username]);
    if (existing) {
      res.status(409).json({success: false, error: {code: 'CONFLICT', message: 'Phone number or username already exists'}});
      return;
    }

    const id = `GFT-${generateId().slice(0, 8).toUpperCase()}`;
    const ts = now();

    const passwordHash = await hashPassword(password);
    runStatement(db, 'INSERT INTO users (id, phone_number, username, password_hash, display_name, employee_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, phoneNumber, username, passwordHash, displayName, employeeId || null, 'active', ts, ts]);
    saveDb();

    logAuditAction(db, req.admin!.id, 'user.created', 'user', id, `${displayName} (${username})`, {phoneNumber});

    res.status(201).json({
      success: true,
      data: {id, phoneNumber, username, displayName, employeeId, status: 'active', createdAt: ts},
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to create user'}});
  }
});

router.put('/:id', authMiddleware, requirePermission('users.write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.params.id]) as User | undefined;
    if (!user) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'User not found'}});
      return;
    }

    const {displayName, username, employeeId, bio, avatarUrl} = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (displayName !== undefined) { updates.push('display_name = ?'); params.push(displayName); }
    if (username !== undefined) { updates.push('username = ?'); params.push(username); }
    if (employeeId !== undefined) { updates.push('employee_id = ?'); params.push(employeeId); }
    if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
    if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(avatarUrl); }

    if (updates.length === 0) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'No fields to update'}});
      return;
    }

    updates.push('updated_at = ?');
    params.push(now());
    params.push(req.params.id);

    runStatement(db, `UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    saveDb();

    logAuditAction(db, req.admin!.id, 'user.updated', 'user', user.id, user.display_name);
    res.json({success: true, data: {message: 'User updated'}});
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to update user'}});
  }
});

router.put('/:id/status', authMiddleware, requirePermission('users.write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {status} = req.body;
    if (!['active', 'suspended', 'disabled'].includes(status)) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'Invalid status'}});
      return;
    }

    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.params.id]) as User | undefined;
    if (!user) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'User not found'}});
      return;
    }

    runStatement(db, 'UPDATE users SET status = ?, updated_at = ? WHERE id = ?', [status, now(), req.params.id]);
    saveDb();

    logAuditAction(db, req.admin!.id, `user.${status}`, 'user', user.id, user.display_name, {previousStatus: user.status});
    res.json({success: true, data: {message: `User ${status}`}});
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to update user status'}});
  }
});

router.get('/:id/devices', authMiddleware, requirePermission('users.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const devices = queryAll(db, 'SELECT * FROM user_devices WHERE user_id = ? ORDER BY last_active_at DESC', [req.params.id]);

    res.json({
      success: true,
      data: devices.map((d: any) => ({
        id: d.id, deviceType: d.device_type, osVersion: d.os_version, appVersion: d.app_version,
        deviceName: d.device_name, isActive: d.is_active, lastActiveAt: d.last_active_at, createdAt: d.created_at,
      })),
    });
  } catch (error) {
    console.error('Get user devices error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get devices'}});
  }
});

router.delete('/:id/devices/:deviceId', authMiddleware, requirePermission('users.write'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    runStatement(db, 'UPDATE user_devices SET is_active = 0 WHERE id = ? AND user_id = ?', [req.params.deviceId, req.params.id]);
    saveDb();
    logAuditAction(db, req.admin!.id, 'device.revoked', 'device', req.params.deviceId, undefined, {userId: req.params.id});
    res.json({success: true, data: {message: 'Device session revoked'}});
  } catch (error) {
    console.error('Revoke device error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to revoke device'}});
  }
});

router.delete('/:id', authMiddleware, requirePermission('users.delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [req.params.id]) as User | undefined;
    if (!user) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'User not found'}});
      return;
    }

    // Keep historical references valid while removing the account from active views.
    runStatement(db, "UPDATE users SET status = 'deleted', is_online = 0, updated_at = ? WHERE id = ?", [now(), req.params.id]);
    runStatement(db, 'DELETE FROM refresh_tokens WHERE user_id = ?', [req.params.id]);
    saveDb();
    logAuditAction(db, req.admin!.id, 'user.deleted', 'user', user.id, user.display_name);
    res.json({success: true, data: {message: 'User deleted'}});
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to delete user'}});
  }
});

export default router;
