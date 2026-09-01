import {Router, Request, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryScalar, runStatement} from '../../db/helpers';
import {comparePassword, generateAccessToken, generateRefreshToken, now} from '../../utils/auth';
import {authMiddleware, AuthenticatedRequest, logAuditAction} from '../../middleware/auth';
import type {AdminUser} from '../../types';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const {email, password} = req.body;
    if (!email || !password) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'Email and password required'}});
      return;
    }

    const db = await getDb();
    const admin = queryOne(db, 'SELECT * FROM admin_users WHERE (email = ? OR username = ?) AND is_active = 1', [email, email]) as AdminUser | undefined;

    if (!admin) {
      res.status(401).json({success: false, error: {code: 'AUTH_FAILED', message: 'Invalid credentials'}});
      return;
    }

    const valid = await comparePassword(password, admin.password_hash);
    if (!valid) {
      res.status(401).json({success: false, error: {code: 'AUTH_FAILED', message: 'Invalid credentials'}});
      return;
    }

    const payload = {adminId: admin.id, role: admin.role};
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    runStatement(db, 'UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?', [now(), now(), admin.id]);
    saveDb();

    logAuditAction(db, admin.id, 'admin.login', 'admin', admin.id, admin.email);

    res.json({
      success: true,
      data: {
        admin: {
          id: admin.id,
          email: admin.email,
          username: admin.username,
          displayName: admin.display_name,
          role: admin.role,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Internal server error'}});
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const {refreshToken} = req.body;
    if (!refreshToken) {
      res.status(400).json({success: false, error: {code: 'VALIDATION', message: 'Refresh token required'}});
      return;
    }

    const {verifyToken} = require('../../utils/auth');
    const payload = verifyToken(refreshToken);
    const db = await getDb();
    const admin = queryOne(db, 'SELECT * FROM admin_users WHERE id = ? AND is_active = 1', [payload.adminId]) as AdminUser | undefined;

    if (!admin) {
      res.status(401).json({success: false, error: {code: 'UNAUTHORIZED', message: 'Admin not found'}});
      return;
    }

    const newPayload = {adminId: admin.id, role: admin.role};
    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    res.json({
      success: true,
      data: {accessToken: newAccessToken, refreshToken: newRefreshToken},
    });
  } catch (error) {
    res.status(401).json({success: false, error: {code: 'UNAUTHORIZED', message: 'Invalid refresh token'}});
  }
});

router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (!req.admin) {
    res.status(401).json({success: false, error: {code: 'UNAUTHORIZED', message: 'Not authenticated'}});
    return;
  }

  res.json({
    success: true,
    data: {
      id: req.admin.id,
      email: req.admin.email,
      username: req.admin.username,
      displayName: req.admin.display_name,
      role: req.admin.role,
      lastLoginAt: req.admin.last_login_at,
      createdAt: req.admin.created_at,
    },
  });
});

export default router;
