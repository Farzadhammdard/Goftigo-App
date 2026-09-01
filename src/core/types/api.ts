import type {User, Message} from './models';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: ApiError | null;
  meta: PaginationMeta | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  cursor: string | null;
}

export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface PhoneRegistrationRequest {
  phoneNumber: string;
}

export interface OtpVerificationRequest {
  phoneNumber: string;
  code: string;
  sessionId: string;
}

export interface ProfileSetupRequest {
  displayName: string;
  username: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
}

export interface SendMessageRequest {
  conversationId: string;
  type: string;
  content: string;
  replyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateConversationRequest {
  type: 'direct' | 'group';
  participantIds: string[];
  name?: string;
}

export interface SearchUsersRequest extends PaginatedRequest {
  query: string;
  searchType: 'username' | 'phone' | 'userId' | 'all';
}

export interface UploadMediaResponse {
  url: string;
  mimeType: string;
  fileSize: number;
}

export interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: number;
  id: string;
}

export interface WsConversationUpdate {
  conversationId: string;
  lastMessage: Message;
  unreadCount: number;
}

export interface WsTypingIndicator {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface WsPresenceUpdate {
  userId: string;
  isOnline: boolean;
  lastSeenAt: number;
}
