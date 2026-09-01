# Goftegoo — Admin Panel & Backend Analysis

## 1. CURRENT STATE ASSESSMENT

| Component | Status | Notes |
|-----------|--------|-------|
| Backend API | **Does not exist** | Must be built from scratch |
| Database | **Does not exist** | Must be designed and created |
| Admin Panel | **Does not exist** | Must be built from scratch |
| Mobile App | Scaffolded | 34 source files, UI only, no backend connection |
| Authentication | UI only | Phone input + OTP screens exist, no backend logic |
| Data Layer | Empty | `src/data/` directory scaffolded but no implementations |

## 2. REQUIRED BACKEND INFRASTRUCTURE

### Technology Stack
- **Runtime:** Node.js 18+ (LTS)
- **Framework:** Express.js 4.x
- **Language:** TypeScript 5.x
- **Database:** SQLite3 (development) → PostgreSQL (production)
- **ORM:** None (raw SQL for maximum control and performance)
- **Auth:** JWT (access + refresh tokens)
- **WebSocket:** ws (for real-time messaging)
- **Validation:** Zod (shared schema validation)
- **File Storage:** Local filesystem (development) → S3-compatible (production)

### Why SQLite for Development
- Zero configuration
- Single file database
- Portable and testable
- Same SQL dialect as PostgreSQL for easy migration
- Already planned for mobile local storage

## 3. DATABASE SCHEMA

### Core Tables

```sql
-- Admin accounts (separate from regular users)
CREATE TABLE admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'support',  -- super_admin | admin | moderator | support
  is_active INTEGER DEFAULT 1,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Regular users (mobile app)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  employee_id TEXT,
  status TEXT DEFAULT 'active',  -- active | suspended | disabled
  is_verified INTEGER DEFAULT 0,
  is_online INTEGER DEFAULT 0,
  last_seen_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- User devices/sessions
CREATE TABLE user_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_type TEXT NOT NULL,  -- android | ios | web
  os_version TEXT,
  app_version TEXT,
  device_name TEXT,
  push_token TEXT,
  session_token TEXT,
  is_active INTEGER DEFAULT 1,
  last_active_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Conversations
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- direct | group
  name TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Conversation participants
CREATE TABLE conversation_participants (
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- text | image | video | file | voice | system
  content TEXT,
  metadata TEXT,  -- JSON
  reply_to TEXT,
  forwarded_from TEXT,
  is_edited INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  status TEXT DEFAULT 'sent',
  transport_path TEXT DEFAULT 'online',
  sequence_number INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);

-- Groups
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  creator_id TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- Group members
CREATE TABLE group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'member',  -- admin | member
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES groups(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Social posts
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',  -- active | hidden | deleted
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Post comments
CREATE TABLE post_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'active',  -- active | hidden | deleted
  created_at INTEGER NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Post likes
CREATE TABLE post_likes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Reports
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_type TEXT NOT NULL,  -- user | post | comment | group | message
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',  -- open | investigating | resolved | rejected
  assigned_to TEXT,
  resolution TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES admin_users(id)
);

-- System settings
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_by TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (updated_by) REFERENCES admin_users(id)
);

-- Announcements
CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target TEXT DEFAULT 'all',  -- all | selected_users | selected_groups
  target_ids TEXT,  -- JSON array of user/group IDs
  is_active INTEGER DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  FOREIGN KEY (created_by) REFERENCES admin_users(id)
);

-- Audit log
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,  -- user | group | post | report | setting | announcement
  target_id TEXT,
  target_name TEXT,
  metadata TEXT,  -- JSON (non-sensitive)
  result TEXT DEFAULT 'success',  -- success | failure
  created_at INTEGER NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id)
);

-- Nearby sessions (for monitoring)
CREATE TABLE nearby_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  status TEXT DEFAULT 'active',  -- active | completed | failed
  connection_type TEXT,  -- ble | wifi_direct | local_network
  connected_at INTEGER,
  disconnected_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- System health checks
CREATE TABLE system_health (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  status TEXT NOT NULL,  -- ok | warning | error
  message TEXT,
  checked_at INTEGER NOT NULL
);
```

## 4. ADMIN API ENDPOINTS

### Authentication
- `POST /api/admin/auth/login` — Admin login
- `POST /api/admin/auth/logout` — Admin logout
- `POST /api/admin/auth/refresh` — Refresh access token
- `GET /api/admin/auth/me` — Get current admin profile

### Dashboard
- `GET /api/admin/dashboard/stats` — System statistics
- `GET /api/admin/dashboard/health` — System health checks

### User Management
- `GET /api/admin/users` — List users (paginated, filterable)
- `GET /api/admin/users/:id` — Get user details
- `POST /api/admin/users` — Create user
- `PUT /api/admin/users/:id` — Update user
- `DELETE /api/admin/users/:id` — Delete user (soft)
- `PUT /api/admin/users/:id/status` — Change user status (active/suspended/disabled)
- `GET /api/admin/users/:id/devices` — Get user devices
- `DELETE /api/admin/users/:id/devices/:deviceId` — Revoke device session

### Group Management
- `GET /api/admin/groups` — List groups
- `GET /api/admin/groups/:id` — Get group details
- `POST /api/admin/groups` — Create group
- `PUT /api/admin/groups/:id` — Update group
- `DELETE /api/admin/groups/:id` — Delete group
- `GET /api/admin/groups/:id/members` — List members
- `POST /api/admin/groups/:id/members` — Add member
- `DELETE /api/admin/groups/:id/members/:userId` — Remove member

### Social Management
- `GET /api/admin/posts` — List posts (with filters)
- `GET /api/admin/posts/:id` — Get post details
- `PUT /api/admin/posts/:id/status` — Hide/restore/delete post
- `GET /api/admin/posts/:id/comments` — List comments
- `PUT /api/admin/comments/:id/status` — Hide/delete comment

### Reports
- `GET /api/admin/reports` — List reports
- `GET /api/admin/reports/:id` — Get report details
- `PUT /api/admin/reports/:id` — Update report (status, assign, resolve)

### Communication Monitoring
- `GET /api/admin/communication/online-users` — Online users count
- `GET /api/admin/communication/nearby-sessions` — Nearby sessions
- `GET /api/admin/communication/stats` — Message/file transfer stats

### System
- `GET /api/admin/system/health` — System health
- `GET /api/admin/system/settings` — Get settings
- `PUT /api/admin/system/settings` — Update settings
- `GET /api/admin/system/audit-log` — Audit log
- `GET /api/admin/system/announcements` — List announcements
- `POST /api/admin/system/announcements` — Create announcement

### Admin Management
- `GET /api/admin/admins` — List admin users
- `POST /api/admin/admins` — Create admin
- `PUT /api/admin/admins/:id` — Update admin
- `DELETE /api/admin/admins/:id` — Delete admin

## 5. PERMISSION MODEL

```typescript
type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'support';

const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: ['*'],  // All permissions
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
```

## 6. SECURITY MODEL

1. **Password hashing:** bcrypt (12 rounds)
2. **Token system:** JWT access (15min) + refresh (7 days)
3. **Rate limiting:** 5 login attempts per 15 minutes per IP
4. **CORS:** Restricted to admin panel domain
5. **Input validation:** Zod schemas on all endpoints
6. **SQL injection:** Parameterized queries only
7. **Audit logging:** All write operations logged
8. **No secrets in frontend:** All credentials server-side only

## 7. ADMIN PANEL STRUCTURE

### Tech Stack
- React 18 + Vite + TypeScript
- Tailwind CSS (utility-first styling)
- React Router (client-side routing)
- Zustand (state management - same as mobile)
- Recharts (charts)
- React Table (data tables)

### Pages
- Login
- Dashboard (stats + health)
- Users (list, create, detail, devices)
- Groups (list, create, detail)
- Social (posts, comments)
- Reports (list, detail)
- Communication (online users, nearby sessions)
- System (health, settings, announcements, audit log)
- Admins (list, create, edit)

## 8. IMPLEMENTATION PLAN

### Phase 1: Backend Foundation
1. Initialize Node.js + Express + TypeScript project
2. Database connection + migration system
3. Admin auth (login, JWT, middleware)
4. Seed default super admin

### Phase 2: Core Admin APIs
5. Dashboard stats endpoint
6. User CRUD endpoints
7. Group CRUD endpoints
8. Post moderation endpoints
9. Report management endpoints
10. System settings endpoints
11. Audit log system

### Phase 3: Admin Panel UI
12. Initialize React + Vite + Tailwind project
13. Login page
14. Dashboard page
15. User management pages
16. Group management pages
17. Social management pages
18. Reports pages
19. System pages

### Phase 4: Integration
20. Connect admin panel to backend
21. Test full CRUD flows
22. Test user creation → mobile app login
