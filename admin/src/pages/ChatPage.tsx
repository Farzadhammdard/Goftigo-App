import {useState, useEffect, useRef, useCallback} from 'react';
import {api} from '../api/client';
import {adminWs} from '../services/websocket';

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

async function getAdminUserToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/admin/chat/admin-ws-token', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('admin_access')}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await res.json();
    return data.data?.token || null;
  } catch {
    return null;
  }
}

export function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<Conversation | null>(null);
  selectedConvRef.current = selectedConv;

  // Connect WebSocket
  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = await getAdminUserToken();
      if (token && mounted) {
        adminWs.connect(token);
      }
    })();
    return () => { mounted = false; adminWs.disconnect(); };
  }, []);

  useEffect(() => {
    const onConnected = () => setWsConnected(true);
    const onDisconnected = () => setWsConnected(false);

    adminWs.on('connected', onConnected);
    adminWs.on('disconnected', onDisconnected);
    return () => {
      adminWs.off('connected', onConnected);
      adminWs.off('disconnected', onDisconnected);
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
        setMessages(prev => prev.map(m =>
          m.sender_username === 'goftegoo_admin' ? {...m, status: 'read'} : m
        ));
      }
    };

    const onTyping = (data: any) => {
      // Could show typing indicator in header
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

  const loadMessages = async (convId: string) => {
    try {
      const data = await api.getConversationMessages(convId);
      setMessages(data as any);
      adminWs.markRead(convId);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  useEffect(() => { loadConversations(); }, []);

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
      id: tempId, conversation_id: selectedConv.id, sender_id: 'admin',
      content: msgText, type: 'text', status: 'sending', is_edited: 0,
      is_deleted: 0, created_at: Date.now(), sender_username: 'goftegoo_admin',
      sender_name: 'Admin', sender_avatar: null,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const result = await api.sendConversationMessage(selectedConv.id, msgText) as any;
      setMessages(prev => prev.map(m => m.id === tempId ? result.message : m));
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === tempId ? {...m, status: 'failed'} : m));
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

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white rounded-lg shadow overflow-hidden">
      {/* Conversation List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Support Chat</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${wsConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {wsConnected ? '🟢 Live' : '🔴 Offline'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{conversations.length} conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-400">No conversations yet</div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => { setSelectedConv(conv); }}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${
                  selectedConv?.id === conv.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                }`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {(conv.displayName || '?')[0].toUpperCase()}
                    </div>
                    {(conv as any).participants?.some((p: any) => p.is_online === 1 && p.username !== 'goftegoo_admin') && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-medium text-gray-900 truncate">{conv.displayName}</span>
                      {conv.last_message_at && (
                        <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{formatTime(conv.last_message_at)}</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">@{conv.displayUsername}</div>
                    <p className="text-sm text-gray-500 truncate mt-1">{conv.last_message || 'No messages yet'}</p>
                  </div>
                  {(conv.unread_count || 0) > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 flex-shrink-0 font-bold">{conv.unread_count}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold">
                {(selectedConv.displayName || '?')[0].toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{selectedConv.displayName}</h3>
                <p className="text-xs text-gray-400">
                  @{selectedConv.displayUsername} · {selectedConv.displayPublicUserId}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => {
                const isAdmin = msg.sender_username === 'goftegoo_admin';
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-xl px-4 py-2 ${
                      isAdmin
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      {!isAdmin && (
                        <p className="text-xs font-medium text-primary-600 mb-1">{msg.sender_name || msg.sender_username}</p>
                      )}
                      <p className="text-sm">{msg.is_deleted ? <em>Deleted</em> : msg.content}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <p className={`text-xs ${isAdmin ? 'text-primary-100' : 'text-gray-400'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                        {isAdmin && (
                          <span className={`text-xs ${msg.status === 'read' ? 'text-green-300' : msg.status === 'delivered' ? 'text-primary-100' : 'text-primary-200'}`}>
                            {msg.status === 'read' ? '✓✓' : msg.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-2">
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a reply..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={2}
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed self-end">
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-4xl mb-2">💬</p>
              <p className="text-lg">Select a conversation</p>
              <p className="text-sm mt-1">Messages appear in real-time</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
