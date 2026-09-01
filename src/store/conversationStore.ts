import {create} from 'zustand';
import type {Conversation, Message, TransportType} from '../core/types/models';

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;

  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  updateLastMessage: (conversationId: string, message: Message) => void;
  incrementUnread: (conversationId: string) => void;
  resetUnread: (conversationId: string) => void;
  setTransportPath: (conversationId: string, path: TransportType) => void;
  setLoading: (loading: boolean) => void;
  pinConversation: (id: string) => void;
  muteConversation: (id: string) => void;
  sortConversations: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  activeConversationId: null,
  isLoading: false,

  setConversations: (conversations) => set({conversations}),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),

  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? {...c, ...updates} : c,
      ),
    })),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
    })),

  setActiveConversation: (id) => set({activeConversationId: id}),

  updateLastMessage: (conversationId, message) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {...c, lastMessage: message, updatedAt: Date.now()}
          : c,
      ),
    })),

  incrementUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? {...c, unreadCount: c.unreadCount + 1}
          : c,
      ),
    })),

  resetUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? {...c, unreadCount: 0} : c,
      ),
    })),

  setTransportPath: (conversationId, path) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? {...c, transportPath: path} : c,
      ),
    })),

  setLoading: (isLoading) => set({isLoading}),

  pinConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? {...c, isPinned: !c.isPinned} : c,
      ),
    })),

  muteConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? {...c, isMuted: !c.isMuted} : c,
      ),
    })),

  sortConversations: () =>
    set((state) => ({
      conversations: [...state.conversations].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        return b.updatedAt - a.updatedAt;
      }),
    })),
}));
