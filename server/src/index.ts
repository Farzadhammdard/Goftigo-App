import express from 'express';
import cors from 'cors';
import {initializeDatabase} from './db/init';
import {getDb} from './db/connection';
import {queryOne, runStatement} from './db/helpers';
import {hashPassword, generateId, now} from './utils/auth';
import {queryScalar} from './db/helpers';
import {setupWebSocket} from './websocket';

import authRoutes from './routes/admin/auth';
import dashboardRoutes from './routes/admin/dashboard';
import userRoutes from './routes/admin/users';
import groupRoutes from './routes/admin/groups';
import postRoutes from './routes/admin/posts';
import reportRoutes from './routes/admin/reports';
import systemRoutes from './routes/admin/system';
import adminRoutes from './routes/admin/admins';
import adminChatRoutes from './routes/admin/chat';

// Mobile API routes
import mobileAuthRoutes from './routes/mobile/auth';
import mobileUserRoutes from './routes/mobile/users';
import mobileConversationRoutes from './routes/mobile/conversations';
import mobileMessageRoutes from './routes/mobile/messages';
import mobilePostRoutes from './routes/mobile/posts';
import mobileMediaRoutes from './routes/mobile/media';
import mobileFriendRoutes from './routes/mobile/friends';
import mobileNotificationRoutes from './routes/mobile/notifications';
import mobileFollowRoutes from './routes/mobile/follows';
import mobileSettingsRoutes from './routes/mobile/settings';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({limit: '100mb'}));

// Admin API routes
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/admin/groups', groupRoutes);
app.use('/api/admin/posts', postRoutes);
app.use('/api/admin/reports', reportRoutes);
app.use('/api/admin/system', systemRoutes);
app.use('/api/admin/admins', adminRoutes);
app.use('/api/admin/chat', adminChatRoutes);

// Mobile API routes
app.use('/api/auth', mobileAuthRoutes);
app.use('/api/users', mobileUserRoutes);
app.use('/api/conversations', mobileConversationRoutes);
app.use('/api/messages', mobileMessageRoutes);
app.use('/api/posts', mobilePostRoutes);
app.use('/api/media', mobileMediaRoutes);
app.use('/api/friends', mobileFriendRoutes);
app.use('/api/notifications', mobileNotificationRoutes);
app.use('/api/follows', mobileFollowRoutes);
app.use('/api/settings', mobileSettingsRoutes);
app.use('/api/account', mobileSettingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({status: 'ok', timestamp: Date.now(), version: '0.0.1'});
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({success: false, error: {code: 'INTERNAL', message: 'Internal server error'}});
});

async function seedAdmin() {
  const db = await getDb();
  const existing = queryOne(db, "SELECT id FROM admin_users WHERE role = 'super_admin'");

  if (!existing) {
    const id = generateId();
    const ts = now();
    const passwordHash = await hashPassword('admin123');

    runStatement(db,
      'INSERT INTO admin_users (id, email, username, password_hash, display_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, 'admin@goftgoo.com', 'admin', passwordHash, 'Super Admin', 'super_admin', ts, ts]
    );

    console.log('Default super admin created:');
    console.log('  Email:    admin@goftgoo.com');
    console.log('  Password: admin123');
    console.log('  Role:     super_admin');
  }
}

async function seedDefaultSettings() {
  const db = await getDb();
  const ts = now();

  const defaults: Record<string, string> = {
    'app_name': 'Goftegoo',
    'app_name_fa': 'گفتگو',
    'app_version': '0.0.1',
    'registration_enabled': 'true',
    'user_search_enabled': 'true',
    'nearby_enabled': 'true',
    'social_posting_enabled': 'true',
    'maintenance_mode': 'false',
    'max_file_size_mb': '100',
    'allowed_file_types': 'image,video,file,audio',
    'supported_languages': 'fa,ps,en,ar,ur',
  };

  for (const [key, value] of Object.entries(defaults)) {
    const existing = queryOne(db, 'SELECT key FROM system_settings WHERE key = ?', [key]);
    if (!existing) {
      runStatement(db, 'INSERT INTO system_settings (key, value, description, updated_at) VALUES (?, ?, ?, ?)', [key, value, null, ts]);
    }
  }
}

async function seedTestUsers() {
  const db = await getDb();
  const farzad = queryOne(db, 'SELECT id FROM users WHERE username = ?', ['farzad']);
  if (farzad) return;

  const ts = now();
  const users = [
    {phone: '+93700000001', username: 'ahmad', name: 'Ahmad Shah'},
    {phone: '+93700000002', username: 'fatima', name: 'Fatima Karimi'},
    {phone: '+93700000003', username: 'omar', name: 'Omar Farooq'},
    {phone: '+93700000004', username: 'zainab', name: 'Zainab Hosseini'},
    {phone: '+93700000005', username: 'reza', name: 'Reza Ahmadi'},
    {phone: '+93700000006', username: 'farzad', name: 'Farzad Ahmadi', password: '123'},
  ];

  const adminContact = queryOne(db, 'SELECT id FROM users WHERE username = ?', ['goftegoo_admin']) as any;

  for (const u of users) {
    const id = `GFT-${generateId().slice(0, 8).toUpperCase()}`;
    const publicUserId = `GFT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const pwHash = u.password ? await hashPassword(u.password) : null;
    runStatement(db,
      'INSERT INTO users (id, public_user_id, phone_number, username, password_hash, display_name, status, is_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, publicUserId, u.phone, u.username, pwHash, u.name, 'active', 1, ts, ts]
    );

    if (adminContact) {
      const convId = generateId();
      runStatement(db,
        'INSERT INTO conversations (id, type, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [convId, 'direct', null, ts, ts]
      );
      runStatement(db,
        'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [convId, id, 'member', ts]
      );
      runStatement(db,
        'INSERT INTO conversation_participants (conversation_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)',
        [convId, adminContact.id, 'admin', ts]
      );
      runStatement(db,
        'INSERT INTO messages (id, conversation_id, sender_id, type, content, status, transport_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [generateId(), convId, adminContact.id, 'text', `خوش آمدید ${u.name}! به گفتگو خوش آمدید.\nWelcome to Goftegoo!`, 'sent', 'online', ts, ts]
      );
    }
  }

  console.log(`Seeded ${users.length} test users with welcome conversations`);
  console.log('Login: farzad / 123');
}

async function seedAdminContact() {
  const db = await getDb();
  const existing = queryOne(db, "SELECT id FROM users WHERE username = 'goftegoo_admin'");

  if (!existing) {
    const id = `GFT-${generateId().slice(0, 8).toUpperCase()}`;
    const publicUserId = `GFT-${Date.now().toString(36).toUpperCase()}-ADMIN`;
    const ts = now();
    const passwordHash = await hashPassword('admin123');

    runStatement(db,
      `INSERT INTO users (id, public_user_id, phone_number, username, password_hash, display_name, status, is_verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, publicUserId, '+93000000000', 'goftegoo_admin', passwordHash, 'گفتگو (Goftegoo)', 'active', 1, ts, ts]
    );

    console.log('Default admin contact user created:');
    console.log('  Username:  goftegoo_admin');
    console.log('  Public ID: GFT-...-ADMIN');
    console.log('  Display:   گفتگو (Goftegoo)');
  }
}

async function main() {
  await initializeDatabase();
  await seedAdmin();
  await seedDefaultSettings();
  await seedAdminContact();
  await seedTestUsers();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Goftegoo Server running on http://0.0.0.0:${PORT}`);
    console.log(`Admin API: http://localhost:${PORT}/api/admin`);
    console.log(`Mobile API: http://localhost:${PORT}/api`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
  });

  // Initialize WebSocket server
  setupWebSocket(server);
}

main().catch(console.error);
