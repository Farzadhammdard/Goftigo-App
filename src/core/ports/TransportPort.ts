import type {TransportType} from '../types/models';
import type {
  TransportCapabilities,
  ConnectionStatus,
  OutgoingMessage,
  IncomingMessage,
  SendResult,
} from '../types/transport';

export interface CommunicationTransport {
  readonly type: TransportType;
  readonly isAvailable: boolean;

  initialize(): Promise<void>;
  destroy(): Promise<void>;

  connect(targetId: string): Promise<string>;
  disconnect(connectionId: string): Promise<void>;

  sendMessage(connectionId: string, message: OutgoingMessage): Promise<SendResult>;
  onMessage(handler: (message: IncomingMessage) => void): void;

  getConnectionStatus(connectionId: string): ConnectionStatus;
  onStatusChange(handler: (status: {connectionId: string; status: ConnectionStatus}) => void): void;

  getCapabilities(): TransportCapabilities;
}
