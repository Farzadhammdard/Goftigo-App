import {Request, Response, NextFunction} from 'express';
import {Database as SqlJsDatabase} from 'sql.js';
import {verifyToken} from '../utils/auth';
import {getDb} from '../db/connection';
import {queryOne, runStatement} from '../db/helpers';
import type {AdminUser, JwtPayload} from '../types';

export interface AuthenticatedRequest extends Request {
  admin?: AdminUser;
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],
  admin: [
    'users.read', 'users.write', 'users.delete',
    'groups.read', 'groups.write', 'groups.delete',
    'posts.read', 'posts.moderate',
    'reports.read', 'reports.manage',
    'settings.read', 'settings.write',
    'announcements.manage',
    'admins.read',
    'communication.read',
    'audit.read',
  ],
  moderator: [
    'users.read',
    'groups.read',
    'posts.read', 'posts.moderate',
    'reports.read', 'reports.manage',
    'communication.read',
  ],
  support: [
    'users.read',
    'groups.read',
    'posts.read',
    'reports.read',
    'communication.read',
  ],
};

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({success: false, error: {code: 'UNAUTHORIZED', message: 'No token provided'}});
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token) as JwtPayload;
    const db = await getDb();
    const admin = queryOne(db, 'SELECT * FROM admin_users WHERE id = ? AND is_active = 1', [payload.adminId]) as AdminUser | undefined;

    if (!admin) {
      res.status(401).json({success: false, error: {code: 'UNAUTHORIZED', message: 'Admin not found or inactive'}});
      return;
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({success: false, error: {code: 'UNAUTHORIZED', message: 'Invalid or expired token'}});
  }
}

export function requirePermission(...permissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      res.status(401).json({success: false, error: {code: 'UNAUTHORIZED', message: 'Not authenticated'}});
      return;
    }

    const role = req.admin.role;
    const rolePerms = ROLE_PERMISSIONS[role] || [];

    if (rolePerms.includes('*')) {
      next();
      return;
    }

    const hasPermission = permissions.every((p) => rolePerms.includes(p));
    if (!hasPermission) {
      res.status(403).json({success: false, error: {code: 'FORBIDDEN', message: 'Insufficient permissions'}});
      return;
    }

    next();
  };
}

export function logAuditAction(
  db: SqlJsDatabase,
  adminId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  targetName?: string,
  metadata?: Record<string, unknown>,
  result: string = 'success',
): void {
  const {v4} = require('uuid');
  runStatement(db,
    'INSERT INTO audit_log (id, admin_id, action, target_type, target_id, target_name, metadata, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [v4(), adminId, action, targetType || null, targetId || null, targetName || null, metadata ? JSON.stringify(metadata) : null, result, Date.now()]
  );
}
