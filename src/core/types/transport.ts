import type {TransportType} from './models';

export interface TransportCapabilities {
  supportsText: boolean;
  supportsFiles: boolean;
  supportsVoice: boolean;
  supportsMedia: boolean;
  maxFileSize: number;
  isEncrypted: boolean;
  requiresProximity: boolean;
  requiresInternet: boolean;
}

export interface ConnectionStatus {
  isConnected: boolean;
  latency: number | null;
  lastActiveAt: number;
}

export interface ConnectionStatusEvent {
  connectionId: string;
  status: ConnectionStatus;
  transportType: TransportType;
}

export interface OutgoingMessage {
  id: string;
  conversationId: string;
  content: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface IncomingMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  metadata?: Record<string, unknown>;
  transportPath: TransportType;
  receivedAt: number;
}

export interface SendResult {
  success: boolean;
  messageId: string;
  transportPath: TransportType;
  timestamp: number;
  error?: string;
}

export interface TransportAvailability {
  online: boolean;
  localNetwork: boolean;
  nearbyP2P: boolean;
  mesh: boolean;
}
