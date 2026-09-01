export type WsEventType =
  | 'message.new'
  | 'message.status'
  | 'message.edit'
  | 'message.delete'
  | 'message.reaction'
  | 'conversation.update'
  | 'conversation.create'
  | 'typing'
  | 'presence'
  | 'connection.request'
  | 'connection.accept'
  | 'connection.reject'
  | 'nearby.device'
  | 'sync.required'
  | 'notification';

export interface WsEvent {
  type: WsEventType;
  payload: unknown;
  timestamp: number;
}

export interface MessageEvent {
  type: 'message.new' | 'message.status' | 'message.edit' | 'message.delete' | 'message.reaction';
  payload: {
    messageId: string;
    conversationId: string;
    senderId: string;
    content?: string;
    status?: string;
    reaction?: {userId: string; emoji: string};
  };
}

export interface ConversationEvent {
  type: 'conversation.update' | 'conversation.create';
  payload: {
    conversationId: string;
    lastMessage?: unknown;
    unreadCount?: number;
  };
}

export type EventHandler<T = unknown> = (data: T) => void;

export interface EventBus {
  on<T>(eventType: WsEventType, handler: EventHandler<T>): () => void;
  emit(eventType: WsEventType, data: unknown): void;
  off(eventType: WsEventType, handler: EventHandler): void;
}
