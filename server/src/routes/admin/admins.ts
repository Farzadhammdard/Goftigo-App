import {Router, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryAll, runStatement} from '../../db/helpers';
import {authMiddleware, requirePermission, AuthenticatedRequest, logAuditAction} from '../../middleware/auth';
import {hashPassword, generateId, now} from '../../utils/auth';
import type {AdminUser} from '../../types';

const router = Router();

router.get('/', authMiddleware, requirePermission('admins.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await getDb();
    const admins = queryAll(db, 'SELECT id, email, username, display_name, role, is_active, last_login_at, created_at FROM admin_users ORDER BY created_at DESC');
    res.json({
      success: true,
      data: admins.map((a: any) => ({
        id: a.id, email: a.email, username: a.username, displayName: a.display_name,
        role: a.role, isActive: a.is_active, lastLoginAt: a.last_login_at, createdAt: a.created_at,
      })),
    });
  } catch (error) {
    console.error('List admins error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to list admins'}});
  }
});

router.post('/', authMiddleware, requirePermission('admins.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.admin!.role !== 'super_admin') {
      res.status(403).json({success: false, error: {code: 'FORBIDDEN', message: 'Only super admin can create admins'}});
      return;
    }

    const {email, username, password, displayName, role = 'support'} = req.body;
    if (!email || !username || !password || !displayName) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'All fields required'}});
      return;
    }

    if (!['admin', 'moderator', 'support'].includes(role)) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'Invalid role'}});
      return;
    }

    const db = await getDb();
    const existing = queryOne(db, 'SELECT id FROM admin_users WHERE email = ? OR username = ?', [email, username]);
    if (existing) {
      res.status(409).json({success: false, error: {code: 'CONFLICT', message: 'Email or username already exists'}});
      return;
    }

    const id = generateId();
    const ts = now();
    const passwordHash = await hashPassword(password);

    runStatement(db, 'INSERT INTO admin_users (id, email, username, password_hash, display_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, email, username, passwordHash, displayName, role, ts, ts]);
    saveDb();

    logAuditAction(db, req.admin!.id, 'admin.created', 'admin', id, `${displayName} (${email})`, {role});
    res.status(201).json({success: true, data: {id, email, username, displayName, role, createdAt: ts}});
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to create admin'}});
  }
});

router.put('/:id', authMiddleware, requirePermission('admins.read'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.admin!.role !== 'super_admin' && req.admin!.id !== req.params.id) {
      res.status(403).json({success: false, error: {code: 'FORBIDDEN', message: 'Cannot modify other admins'}});
      return;
    }

    const db = await getDb();
    const admin = queryOne(db, 'SELECT * FROM admin_users WHERE id = ?', [req.params.id]) as AdminUser | undefined;
    if (!admin) {
      res.status(404).json({success: false, error: {code: 'NOT_FOUND', message: 'Admin not found'}});
      return;
    }

    const {displayName, role, isActive} = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (displayName !== undefined) { updates.push('display_name = ?'); params.push(displayName); }
    if (role !== undefined && req.admin!.role === 'super_admin') { updates.push('role = ?'); params.push(role); }
    if (isActive !== undefined && req.admin!.role === 'super_admin') { updates.push('is_active = ?'); params.push(isActive ? 1 : 0); }

    if (updates.length === 0) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'No fields to update'}});
      return;
    }

    updates.push('updated_at = ?');
    params.push(now());
    params.push(req.params.id);

    runStatement(db, `UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`, params);
    saveDb();

    logAuditAction(db, req.admin!.id, 'admin.updated', 'admin', admin.id, admin.display_name);
    res.json({success: true, data: {message: 'Admin updated'}});
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to update admin'}});
  }
});

export default router;
