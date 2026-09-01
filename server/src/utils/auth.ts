import jwt from 'jsonwebtoken';
import type {JwtPayload} from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'goftgoo-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {expiresIn: JWT_EXPIRES_IN});
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {expiresIn: REFRESH_EXPIRES_IN});
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function hashPassword(password: string): Promise<string> {
  const bcrypt = require('bcryptjs');
  return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = require('bcryptjs');
  return bcrypt.compare(password, hash);
}

export function generateId(): string {
  const {v4} = require('uuid');
  return v4();
}

export function now(): number {
  return Date.now();
}
