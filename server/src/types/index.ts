export type AdminRole = 'super_admin' | 'admin' | 'moderator' | 'support';
export type UserStatus = 'active' | 'suspended' | 'disabled';
export type ReportStatus = 'open' | 'investigating' | 'resolved' | 'rejected';
export type PostStatus = 'active' | 'hidden' | 'deleted';
export type DeviceType = 'android' | 'ios' | 'web';

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: AdminRole;
  is_active: number;
  last_login_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface User {
  id: string;
  public_user_id: string;
  phone_number: string;
  username: string;
  password_hash: string | null;
  display_name: string;
  avatar_url: string | null;
  profile_photo: string | null;
  bio: string | null;
  employee_id: string | null;
  status: UserStatus;
  is_verified: number;
  is_online: number;
  last_seen_at: number | null;
  last_active: number | null;
  created_at: number;
  updated_at: number;
}

export interface UserDevice {
  id: string;
  user_id: string;
  device_type: DeviceType;
  os_version: string | null;
  app_version: string | null;
  device_name: string | null;
  push_token: string | null;
  session_token: string | null;
  is_active: number;
  last_active_at: number | null;
  created_at: number;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  content: string | null;
  metadata: string | null;
  reply_to: string | null;
  forwarded_from: string | null;
  is_edited: number;
  is_deleted: number;
  status: string;
  transport_path: string;
  sequence_number: number | null;
  created_at: number;
  updated_at: number;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  creator_id: string;
  is_active: number;
  created_at: number;
  updated_at: number;
}

export interface Post {
  id: string;
  author_id: string;
  image_url: string;
  caption: string | null;
  like_count: number;
  comment_count: number;
  share_count: number;
  status: PostStatus;
  created_at: number;
  updated_at: number;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  status: PostStatus;
  created_at: number;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  assigned_to: string | null;
  resolution: string | null;
  created_at: number;
  resolved_at: number | null;
}

export interface SystemSetting {
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  updated_at: number;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  target: string;
  target_ids: string | null;
  is_active: number;
  created_by: string;
  created_at: number;
  expires_at: number | null;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  metadata: string | null;
  result: string;
  created_at: number;
}

export interface NearbySession {
  id: string;
  user_id: string;
  device_id: string;
  status: string;
  connection_type: string | null;
  connected_at: number | null;
  disconnected_at: number | null;
  created_at: number;
}

export interface JwtPayload {
  adminId: string;
  role: AdminRole;
}

export interface AuthRequest extends Express.Request {
  admin?: AdminUser;
}
