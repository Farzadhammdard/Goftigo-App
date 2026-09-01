import {create} from 'zustand';
import type {Message} from '../core/types/models';

interface MessageState {
  messagesByConversation: Record<string, Message[]>;
  isLoading: boolean;
  hasMoreByConversation: Record<string, boolean>;

  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  appendMessages: (conversationId: string, messages: Message[]) => void;
  setHasMore: (conversationId: string, hasMore: boolean) => void;
  setLoading: (loading: boolean) => void;
  getMessages: (conversationId: string) => Message[];
  addReaction: (conversationId: string, messageId: string, userId: string, emoji: string) => void;
  removeReaction: (conversationId: string, messageId: string, userId: string) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messagesByConversation: {},
  isLoading: false,
  hasMoreByConversation: {},

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: messages,
      },
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] || [];
      const exists = existing.some((m) => m.id === message.id);
      if (exists) return state;
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [message, ...existing],
        },
      };
    }),

  updateMessage: (conversationId, messageId, updates) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] || [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: existing.map((m) =>
            m.id === messageId ? {...m, ...updates} : m,
          ),
        },
      };
    }),

  removeMessage: (conversationId, messageId) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] || [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: existing.filter((m) => m.id !== messageId),
        },
      };
    }),

  appendMessages: (conversationId, messages) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] || [];
      const newMessages = messages.filter(
        (m) => !existing.some((e) => e.id === m.id),
      );
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...existing, ...newMessages],
        },
      };
    }),

  setHasMore: (conversationId, hasMore) =>
    set((state) => ({
      hasMoreByConversation: {
        ...state.hasMoreByConversation,
        [conversationId]: hasMore,
      },
    })),

  setLoading: (isLoading) => set({isLoading}),

  getMessages: (conversationId) => {
    return get().messagesByConversation[conversationId] || [];
  },

  addReaction: (conversationId, messageId, userId, emoji) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] || [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: existing.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  reactions: [
                    ...m.reactions.filter((r) => r.userId !== userId),
                    {userId, emoji, createdAt: Date.now()},
                  ],
                }
              : m,
          ),
        },
      };
    }),

  removeReaction: (conversationId, messageId, userId) =>
    set((state) => {
      const existing = state.messagesByConversation[conversationId] || [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: existing.map((m) =>
            m.id === messageId
              ? {...m, reactions: m.reactions.filter((r) => r.userId !== userId)}
              : m,
          ),
        },
      };
    }),
}));
