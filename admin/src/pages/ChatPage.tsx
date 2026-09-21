import {useState, useEffect, useRef, useCallback} from 'react';
import {api} from '../api/client';
import {adminWs} from '../services/websocket';
import {useRealtimeStore} from '../store/realtimeStore';
import {Avatar} from '../components/ui';

interface Conversation {
  id: string;
  type: string;
  displayName: string;
  displayAvatar: string | null;
  displayUserId: string;
  displayUsername: string;
  displayPublicUserId: string;
  last_message: string;
  last_message_sender: string;
  last_message_at: number;
  unread_count: number;
  participants: any[];
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: string;
  status: string;
  is_edited: number;
  is_deleted: number;
  created_at: number;
  sender_username: string;
  sender_name: string;
  sender_avatar: string | null;
}

export function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const wsConnected = useRealtimeStore(s => s.connected);
  const onlineUsers = useRealtimeStore(s => s.onlineUsers);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<Conversation | null>(null);
  selectedConvRef.current = selectedConv;

  // The global realtime connection is owned by <Layout>; here we only react.
  useEffect(() => {
    const onConnected = () => loadConversations();
    adminWs.on('connected', onConnected);
    return () => {
      adminWs.off('connected', onConnected);
    };
  }, []);

  // Listen for new messages via WebSocket
  useEffect(() => {
    const onNewMessage = (data: any) => {
      // Update messages if conversation is currently open
      if (selectedConvRef.current?.id === data.conversationId && data.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        // Mark as read
        adminWs.markRead(data.conversationId);
      }

      // Update conversation list
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === data.conversationId);
        if (idx === -1) {
          loadConversations();
          return prev;
        }
        const updated = [...prev];
        const conv = {...updated[idx]};
        conv.last_message = data.message?.content || conv.last_message;
        conv.last_message_sender = data.message?.sender_id;
        conv.last_message_at = data.message?.created_at || Date.now();
        if (selectedConvRef.current?.id !== data.conversationId) {
          conv.unread_count = (conv.unread_count || 0) + 1;
        }
        updated.splice(idx, 1);
        updated.unshift(conv);
        return updated;
      });
    };

    const onConversationUpdated = (data: any) => {
      if (!data.conversation) return;
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === data.conversationId);
        if (idx === -1) {
          loadConversations();
          return prev;
        }
        const updated = [...prev];
        const convData = data.conversation;
        updated[idx] = {
          ...updated[idx],
          last_message: convData.last_message,
          last_message_sender: convData.last_message_sender,
          last_message_at: convData.last_message_at,
        };
        const moved = updated.splice(idx, 1)[0];
        updated.unshift(moved);
        return updated;
      });
    };

    const onMessagesRead = (data: any) => {
      if (selectedConvRef.current?.id === data.conversationId) {
        setMessages(prev =>
          prev.map(m =>
            m.sender_username === 'goftegoo_admin' ? {...m, status: 'read'} : m,
          ),
        );
      }
    };

    const onTyping = (data: any) => {
      if (!data.conversationId || data.userId === 'goftegoo_admin') return;
      setTypingUsers(prev => ({...prev, [data.conversationId]: data.isTyping}));
      if (data.isTyping) {
        window.setTimeout(
          () =>
            setTypingUsers(prev => ({...prev, [data.conversationId]: false})),
          3000,
        );
      }
    };

    adminWs.on('new_message', onNewMessage);
    adminWs.on('conversation:updated', onConversationUpdated);
    adminWs.on('messages_read', onMessagesRead);
    adminWs.on('typing', onTyping);
    return () => {
      adminWs.off('new_message', onNewMessage);
      adminWs.off('conversation:updated', onConversationUpdated);
      adminWs.off('messages_read', onMessagesRead);
      adminWs.off('typing', onTyping);
    };
  }, []);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await api.getConversations();
      setConversations(data as any);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const result = await api.getUsers({
        page: '1',
        pageSize: '100',
        status: 'active',
      });
      setUsers((result as any).data || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const data = await api.getConversationMessages(convId);
      setMessages(data as any);
      adminWs.markRead(convId);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  useEffect(() => {
    loadConversations();
    loadUsers();
  }, []);

  const openUserChat = async (user: any) => {
    try {
      const result = await api.createUserConversation(user.id);
      await loadConversations();
      const refreshed = (await api.getConversations()) as any;
      const conversation = (
        Array.isArray(refreshed) ? refreshed : refreshed.data || []
      ).find((item: Conversation) => item.id === result.conversationId);
      if (conversation) setSelectedConv(conversation);
    } catch (error: any) {
      alert(error.message || 'Could not open user chat');
    }
  };

  const handleMedia = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConv || sendingMedia) return;
    setSendingMedia(true);
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const type = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'voice'
            : 'file';
      const result = (await api.sendConversationMedia(selectedConv.id, {
        data,
        mimeType: file.type || 'application/octet-stream',
        filename: file.name,
        type,
      })) as any;
      setMessages(prev => [...prev, result.message]);
    } catch (error: any) {
      alert(error.message || 'Could not upload file');
    } finally {
      setSendingMedia(false);
      event.target.value = '';
    }
  };

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id);
    }
  }, [selectedConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv || sending) return;
    const msgText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Optimistic
    const tempId = `admin-temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: selectedConv.id,
      sender_id: 'admin',
      content: msgText,
      type: 'text',
      status: 'sending',
      is_edited: 0,
      is_deleted: 0,
      created_at: Date.now(),
      sender_username: 'goftegoo_admin',
      sender_name: 'Admin',
      sender_avatar: null,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const result = (await api.sendConversationMessage(
        selectedConv.id,
        msgText,
      )) as any;
      setMessages(prev =>
        prev.map(m => (m.id === tempId ? result.message : m)),
      );
    } catch (error) {
      setMessages(prev =>
        prev.map(m => (m.id === tempId ? {...m, status: 'failed'} : m)),
      );
      console.error('Failed to send:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const isConvOnline = (conv: Conversation) =>
    onlineUsers[conv.displayUserId] ??
    (conv as any).participants?.some(
      (p: any) => p.is_online === 1 && p.username !== 'goftegoo_admin',
    );

  return (
    <div className="glass-card flex h-[calc(100vh-7rem)] overflow-hidden animate-fade-up">
      {/* Conversation List */}
      <div className="flex w-80 shrink-0 flex-col border-r border-white/20 dark:border-white/10">
        <div className="border-b border-white/20 p-4 dark:border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Support Chat
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                wsConnected
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : 'border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300'
              }`}>
              <span
                className={`h-1.5 w-1.5 rounded-full ${wsConnected ? 'live-dot bg-emerald-500 text-emerald-500' : 'bg-rose-500'}`}
              />
              {wsConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {conversations.length} conversations
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-white/20 p-3 dark:border-white/10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              All users
            </p>
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {users.map(user => {
                const conversation = conversations.find(
                  conv => conv.displayUserId === user.id,
                );
                return (
                  <button
                    key={user.id}
                    onClick={() =>
                      conversation
                        ? setSelectedConv(conversation)
                        : openUserChat(user)
                    }
                    className="flex w-full items-center gap-2 rounded-xl p-2 text-left transition hover:bg-white/50 dark:hover:bg-white/5">
                    <Avatar
                      src={user.avatarUrl}
                      name={user.displayName || user.username}
                      size={32}
                      online={!!onlineUsers[user.id]}
                    />
                    <span className="truncate text-sm text-slate-700 dark:text-slate-200">
                      {user.displayName || user.username}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({length: 5}).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-2xl" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              No conversations yet
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                className={`cursor-pointer border-b border-white/10 p-3.5 transition dark:border-white/5 ${
                  selectedConv?.id === conv.id
                    ? 'bg-gradient-to-r from-blue-500/15 to-indigo-500/10'
                    : 'hover:bg-white/40 dark:hover:bg-white/5'
                }`}>
                <div className="flex items-center gap-3">
                  <Avatar
                    src={conv.displayAvatar}
                    name={conv.displayName}
                    size={42}
                    online={isConvOnline(conv)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <span className="truncate font-semibold text-slate-900 dark:text-white">
                        {conv.displayName}
                      </span>
                      {conv.last_message_at && (
                        <span className="ml-2 shrink-0 text-[11px] text-slate-400">
                          {formatTime(conv.last_message_at)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      @{conv.displayUsername}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
                      {typingUsers[conv.id] ? (
                        <span className="font-medium text-blue-500">
                          typing…
                        </span>
                      ) : (
                        conv.last_message || 'No messages yet'
                      )}
                    </p>
                  </div>
                  {(conv.unread_count || 0) > 0 && (
                    <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-1 flex-col">
        {selectedConv ? (
          <>
            <div className="flex items-center gap-3 border-b border-white/20 p-4 dark:border-white/10">
              <Avatar
                src={selectedConv.displayAvatar}
                name={selectedConv.displayName}
                size={42}
                online={isConvOnline(selectedConv)}
              />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {selectedConv.displayName}
                </h3>
                <p className="text-xs text-slate-400">
                  @{selectedConv.displayUsername} ·{' '}
                  {selectedConv.displayPublicUserId}
                </p>
                {typingUsers[selectedConv.id] && (
                  <p className="mt-0.5 text-xs text-blue-500">typing…</p>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map(msg => {
                const isAdmin = msg.sender_username === 'goftegoo_admin';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-md ${
                        isAdmin
                          ? 'rounded-br-sm bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                          : 'rounded-bl-sm bg-white/70 text-slate-900 dark:bg-white/10 dark:text-slate-100'
                      }`}>
                      <p className="text-sm leading-relaxed">
                        {msg.is_deleted ? <em>Deleted</em> : msg.content}
                      </p>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <p
                          className={`text-[10px] ${isAdmin ? 'text-blue-100' : 'text-slate-400'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                        {isAdmin && (
                          <span
                            className={`text-[10px] ${msg.status === 'read' ? 'text-emerald-300' : 'text-blue-100'}`}>
                            {msg.status === 'read' || msg.status === 'delivered'
                              ? '✓✓'
                              : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-white/20 p-4 dark:border-white/10">
              <div className="mb-2 flex items-center gap-2">
                <label className="glass cursor-pointer rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-white/80 dark:text-slate-200 dark:hover:bg-white/10">
                  {sendingMedia ? 'Uploading…' : '📎 Attach file'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleMedia}
                    disabled={sendingMedia}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip,.txt"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={e => {
                    setNewMessage(e.target.value);
                    adminWs.send({
                      type: 'typing',
                      conversationId: selectedConv.id,
                      isTyping: e.target.value.length > 0,
                    });
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a reply…"
                  className="glass-input flex-1 resize-none"
                  rows={2}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="self-end rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
                  {sending ? '…' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-slate-400">
            <div className="text-center">
              <p className="mb-2 text-5xl">💬</p>
              <p className="text-lg font-medium text-slate-600 dark:text-slate-300">
                Select a conversation
              </p>
              <p className="mt-1 text-sm">Messages appear in real-time</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
