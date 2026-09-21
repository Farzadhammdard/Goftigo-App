import {Router, Request, Response} from 'express';
import {getDb, saveDb} from '../../db/connection';
import {queryOne, queryScalar, runStatement} from '../../db/helpers';
import {generateId, now, hashPassword, comparePassword} from '../../utils/auth';
import {generateOtp, generateSessionId, generateMobileAccessToken, generateMobileRefreshToken, verifyMobileToken} from '../../utils/mobileAuth';
import {mobileAuthMiddleware, MobileAuthRequest} from '../../middleware/mobileAuth';
import {notifyAdmins} from '../../websocket';
import type {User} from '../../types';

const ADMIN_CONTACT_USERNAME = 'goftegoo_admin';

function generatePublicUserId(): string {
  return `GFT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function getAdminContactUser(db: any): Promise<User | undefined> {
  return queryOne(db, 'SELECT * FROM users WHERE username = ?', [ADMIN_CONTACT_USERNAME]) as User | undefined;
}

async function createWelcomeConversation(db: any, newUserId: string, ts: number): Promise<void> {
  const adminContact = await getAdminContactUser(db);
  if (!adminContact) return;

  const convId = generateId();
  runStatement(db,
    'INSERT INTO conversations (id, type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [convId, 'direct', null, ts, ts]
  );

  runStatement(db,
    'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
    [convId, newUserId, 'member', ts]
  );
  runStatement(db,
    'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
    [convId, adminContact.id, 'admin', ts]
  );

  runStatement(db,
    'INSERT INTO messages (id, conversation_id, sender_id, type, content, status, transport_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [generateId(), convId, adminContact.id, 'text', 'خوش آمدید! به گفتگو خوش آمدید. 🎉\nWelcome to Goftegoo! We\'re happy to have you here.', 'sent', 'online', ts, ts]
  );
}

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const {username, password} = req.body;
    if (!username || !password) {
      res.status(400).json({success: false, error: {code: 'MISSING_FIELDS', message: 'Username and password required'}});
      return;
    }

    const db = await getDb();
    const user = queryOne(db, 'SELECT * FROM users WHERE username = ? AND status = ?', [username, 'active']) as User | undefined;

    if (!user) {
      res.status(401).json({success: false, error: {code: 'INVALID_CREDENTIALS', message: 'Invalid username or password'}});
      return;
    }

    if (!user.password_hash) {
      res.status(401).json({success: false, error: {code: 'NO_PASSWORD', message: 'This account has no password set. Use OTP login.'}});
      return;
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({success: false, error: {code: 'INVALID_CREDENTIALS', message: 'Invalid username or password'}});
      return;
    }

    const ts = now();
    const accessToken = generateMobileAccessToken(user.id);
    const refreshToken = generateMobileRefreshToken(user.id);

    runStatement(db,
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      [generateId(), user.id, refreshToken, ts + 30 * 24 * 60 * 60 * 1000, ts]
    );
    runStatement(db, 'UPDATE users SET last_seen_at = ?, is_online = 1 WHERE id = ?', [ts, user.id]);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          publicUserId: user.public_user_id,
          phoneNumber: user.phone_number,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          bio: user.bio,
          needsProfileSetup: false,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to login'}});
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const {username, phoneNumber, password, confirmPassword} = req.body;

    if (!username || !phoneNumber || !password || !confirmPassword) {
      res.status(400).json({success: false, error: {code: 'MISSING_FIELDS', message: 'All fields are required'}});
      return;
    }

    if (username.length < 3 || username.length > 20) {
      res.status(400).json({success: false, error: {code: 'INVALID_USERNAME', message: 'Username must be 3-20 characters'}});
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      res.status(400).json({success: false, error: {code: 'INVALID_USERNAME', message: 'Username can only contain letters, numbers, and underscores'}});
      return;
    }

    if (!phoneNumber.startsWith('+') || phoneNumber.length < 10) {
      res.status(400).json({success: false, error: {code: 'INVALID_PHONE', message: 'Valid phone number required (e.g. +93700000000)'}});
      return;
    }

    if (password.length < 4) {
      res.status(400).json({success: false, error: {code: 'WEAK_PASSWORD', message: 'Password must be at least 4 characters'}});
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({success: false, error: {code: 'PASSWORD_MISMATCH', message: 'Passwords do not match'}});
      return;
    }

    const db = await getDb();
    const ts = now();

    const existingUsername = queryOne(db, 'SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsername) {
      res.status(409).json({success: false, error: {code: 'USERNAME_TAKEN', message: 'Username already taken'}});
      return;
    }

    const existingPhone = queryOne(db, 'SELECT id FROM users WHERE phone_number = ?', [phoneNumber]);
    if (existingPhone) {
      res.status(409).json({success: false, error: {code: 'PHONE_TAKEN', message: 'Phone number already registered'}});
      return;
    }

    const userId = `GFT-${generateId().slice(0, 8).toUpperCase()}`;
    const publicUserId = generatePublicUserId();
    const passwordHash = await hashPassword(password);

    runStatement(db,
      `INSERT INTO users (id, public_user_id, phone_number, username, password_hash, display_name, status, is_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, publicUserId, phoneNumber, username, passwordHash, username, 'active', 1, ts, ts]
    );

    await createWelcomeConversation(db, userId, ts);

    const accessToken = generateMobileAccessToken(userId);
    const refreshToken = generateMobileRefreshToken(userId);

    runStatement(db,
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      [generateId(), userId, refreshToken, ts + 30 * 24 * 60 * 60 * 1000, ts]
    );

    saveDb();

    notifyAdmins({
      kind: 'user.created',
      title: 'New user registered',
      body: `${username} (@${username}) just joined Goftgoo`,
      icon: '👤',
      level: 'success',
      link: '/users',
      data: {userId, username, displayName: username, publicUserId},
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: userId,
          publicUserId,
          phoneNumber,
          username,
          displayName: username,
          avatarUrl: null,
          bio: null,
          needsProfileSetup: false,
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to register'}});
  }
});

// POST /api/auth/send-otp
router.post('/send-otp', async (req: Request, res: Response) => {
  try {
    const {phoneNumber} = req.body;
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      res.status(400).json({success: false, error: {code: 'INVALID_PHONE', message: 'Valid phone number required'}});
      return;
    }

    const db = await getDb();
    const code = generateOtp();
    const sessionId = generateSessionId();
    const ts = now();
    const expiresAt = ts + 5 * 60 * 1000; // 5 minutes

    runStatement(db,
      'INSERT INTO otp_codes (id, phone_number, code, session_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), phoneNumber, code, sessionId, expiresAt, ts]
    );

    // In production, send SMS via Twilio/provider. For dev, log the code.
    console.log(`[OTP] ${phoneNumber} -> ${code} (session: ${sessionId})`);

    // Save DB so file-based tools can read the OTP in dev
    saveDb();

    res.json({success: true, data: {sessionId, expiresIn: 300, code: process.env.NODE_ENV !== 'production' ? code : undefined}});
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to send OTP'}});
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const {phoneNumber, code, sessionId} = req.body;
    if (!phoneNumber || !code || !sessionId) {
      res.status(400).json({success: false, error: {code: 'MISSING_FIELDS', message: 'Phone, code, and sessionId required'}});
      return;
    }

    const db = await getDb();
    const ts = now();

    const otp = queryOne(
      db,
      'SELECT * FROM otp_codes WHERE phone_number = ? AND session_id = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
      [phoneNumber, sessionId, ts]
    );

    if (!otp || otp.code !== code) {
      res.status(401).json({success: false, error: {code: 'INVALID_OTP', message: 'Invalid or expired OTP'}});
      return;
    }

    // Mark OTP as used
    runStatement(db, 'UPDATE otp_codes SET used = 1 WHERE id = ?', [otp.id]);

    // Find or create user
    let user = queryOne(db, 'SELECT * FROM users WHERE phone_number = ?', [phoneNumber]) as User | undefined;

    if (!user) {
      const userId = `GFT-${generateId().slice(0, 8).toUpperCase()}`;
      const publicUserId = generatePublicUserId();
      runStatement(db,
        'INSERT INTO users (id, public_user_id, phone_number, username, display_name, status, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, publicUserId, phoneNumber, `user_${userId.slice(4, 12)}`, 'User', 'active', 1, ts, ts]
      );
      user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [userId]) as User;

      await createWelcomeConversation(db, userId, ts);

      saveDb();
      notifyAdmins({
        kind: 'user.created',
        title: 'New user registered',
        body: `${user.username} joined via phone ${phoneNumber}`,
        icon: '👤',
        level: 'success',
        link: '/users',
        data: {userId, username: user.username, publicUserId, phoneNumber},
      });
    }

    // Generate tokens
    const accessToken = generateMobileAccessToken(user.id);
    const refreshToken = generateMobileRefreshToken(user.id);

    // Store refresh token
    runStatement(db,
      'INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      [generateId(), user.id, refreshToken, ts + 30 * 24 * 60 * 60 * 1000, ts]
    );

    // Update last seen
    runStatement(db, 'UPDATE users SET last_seen_at = ?, is_online = 1 WHERE id = ?', [ts, user.id]);

    const needsProfileSetup = user.username.startsWith('user_');

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          publicUserId: user.public_user_id,
          phoneNumber: user.phone_number,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          bio: user.bio,
          needsProfileSetup,
        },
      },
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to verify OTP'}});
  }
});

// POST /api/auth/profile-setup
router.post('/profile-setup', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const {displayName, username, avatarUrl} = req.body;
    const userId = req.user!.id;
    const db = await getDb();
    const ts = now();

    if (username) {
      const existing = queryOne(db, 'SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
      if (existing) {
        res.status(409).json({success: false, error: {code: 'USERNAME_TAKEN', message: 'Username already taken'}});
        return;
      }
    }

    runStatement(db,
      'UPDATE users SET display_name = COALESCE(?, display_name), username = COALESCE(?, username), avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?',
      [displayName || null, username || null, avatarUrl || null, ts, userId]
    );

    const user = queryOne(db, 'SELECT * FROM users WHERE id = ?', [userId]) as User;

    res.json({
      success: true,
      data: {
        id: user.id,
        publicUserId: user.public_user_id,
        phoneNumber: user.phone_number,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
      },
    });
  } catch (error) {
    console.error('Profile setup error:', error);
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to update profile'}});
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const {refreshToken} = req.body;
    if (!refreshToken) {
      res.status(400).json({success: false, error: {code: 'MISSING_REFRESH_TOKEN', message: 'Refresh token required'}});
      return;
    }

    const db = await getDb();
    const stored = queryOne(db, 'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > ?', [refreshToken, now()]);

    if (!stored) {
      res.status(401).json({success: false, error: {code: 'INVALID_REFRESH_TOKEN', message: 'Invalid or expired refresh token'}});
      return;
    }

    const payload = verifyMobileToken(refreshToken);
    const newAccessToken = generateMobileAccessToken(payload.userId);

    res.json({success: true, data: {accessToken: newAccessToken}});
  } catch (error) {
    res.status(401).json({success: false, error: {code: 'INVALID_TOKEN', message: 'Invalid refresh token'}});
  }
});

// POST /api/auth/logout
router.post('/logout', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const db = await getDb();
    const ts = now();

    runStatement(db, 'UPDATE users SET is_online = 0, last_seen_at = ? WHERE id = ?', [ts, req.user!.id]);
    runStatement(db, 'DELETE FROM refresh_tokens WHERE user_id = ?', [req.user!.id]);
    saveDb();

    res.json({success: true, data: {message: 'Logged out'}});
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to logout'}});
  }
});

// GET /api/auth/me
router.get('/me', mobileAuthMiddleware, async (req: MobileAuthRequest, res: Response) => {
  try {
    const user = req.user!;
    res.json({
      success: true,
      data: {
        id: user.id,
        publicUserId: user.public_user_id,
        phoneNumber: user.phone_number,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        profilePhoto: user.profile_photo,
        bio: user.bio,
        lastActive: user.last_active,
        isVerified: !!user.is_verified,
      },
    });
  } catch (error) {
    res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Failed to get profile'}});
  }
});

export default router;
