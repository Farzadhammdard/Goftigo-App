import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'goftgoo-dev-secret-change-in-production';
const ACCESS_EXPIRES = '15m';
const REFRESH_EXPIRES = '30d';

export interface MobileJwtPayload {
  userId: string;
}

export function generateMobileAccessToken(userId: string): string {
  return jwt.sign({userId}, JWT_SECRET, {expiresIn: ACCESS_EXPIRES});
}

export function generateMobileRefreshToken(userId: string): string {
  return jwt.sign({userId}, JWT_SECRET, {expiresIn: REFRESH_EXPIRES});
}

export function verifyMobileToken(token: string): MobileJwtPayload {
  return jwt.verify(token, JWT_SECRET) as MobileJwtPayload;
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateSessionId(): string {
  const {v4} = require('uuid');
  return v4();
}
