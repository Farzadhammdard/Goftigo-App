export type UserId = string;
export type ConversationId = string;
export type MessageId = string;
export type GroupId = string;
export type PostId = string;
export type DeviceId = string;
export type ConnectionId = string;

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice' | 'system';
export type ConversationType = 'direct' | 'group';
export type TransportType = 'online' | 'local_network' | 'nearby_p2p' | 'mesh';
export type UserRole = 'admin' | 'member';

export interface User {
  id: UserId;
  publicUserId?: string;
  phoneNumber: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  profilePhoto?: string | null;
  bio: string | null;
  isOnline?: boolean;
  lastSeenAt?: number;
  lastActive?: number;
  isVerified?: boolean;
  needsProfileSetup?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface Conversation {
  id: ConversationId;
  type: ConversationType;
  name: string | null;
  avatarUrl: string | null;
  participantIds: UserId[];
  lastMessage: Message | null;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  transportPath: TransportType;
  createdAt: number;
  updatedAt: number;
}

export interface MessageMetadata {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  waveform?: number[];
  thumbnailUrl?: string;
  localPath?: string;
}

export interface Reaction {
  userId: UserId;
  emoji: string;
  createdAt: number;
}

export interface Translation {
  text: string;
  language: string;
  provider: string;
  createdAt: number;
}

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  senderId: UserId;
  type: MessageType;
  content: string;
  metadata: MessageMetadata | null;
  replyTo: MessageId | null;
  forwardedFrom: UserId | null;
  reactions: Reaction[];
  translation: Translation | null;
  isEdited: boolean;
  isDeleted: boolean;
  isStarred: boolean;
  isPinned: boolean;
  status: MessageStatus;
  transportPath: TransportType;
  sequenceNumber: number;
  createdAt: number;
  updatedAt: number;
}

export interface Group {
  id: GroupId;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  creatorId: UserId;
  adminIds: UserId[];
  memberIds: UserId[];
  createdAt: number;
  updatedAt: number;
}

export interface Post {
  id: PostId;
  authorId: UserId;
  imageUrl: string;
  caption: string | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLikedByMe: boolean;
  isSavedByMe: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface OfflineQueueEntry {
  id: string;
  operation: 'send_message' | 'edit_message' | 'delete_message' | 'create_conversation' | 'upload_file';
  payload: Record<string, unknown>;
  transportPath: TransportType;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  createdAt: number;
  lastAttemptAt: number | null;
}

export interface NearbyDevice {
  deviceId: DeviceId;
  displayName: string;
  userId: UserId | null;
  signalStrength: number;
  transportCapabilities: TransportType[];
  discoveredAt: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface UserProfile {
  user: User;
  isBlocked: boolean;
  isContact: boolean;
  mutualGroups: GroupId[];
}
