import {Request, Response, NextFunction} from 'express';
import {verifyToken} from '../utils/auth';
import {getDb} from '../db/connection';
import {queryOne} from '../db/helpers';
import type {User} from '../types';

export interface MobileAuthRequest extends Request {
  user?: User;
}

export async function mobileAuthMiddleware(req: MobileAuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({success: false, error: {code: 'UNAUTHORIZED', message: 'No token provided'}});
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token) as {userId: string};
    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE id = ? AND status = ?', [payload.userId, 'active']) as User | undefined;

    if (!user) {
      res.status(401).json({success: false, error: {code: 'UNAUTHORIZED', message: 'User not found or inactive'}});
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({success: false, error: {code: 'UNAUTHORIZED', message: 'Invalid or expired token'}});
  }
}
