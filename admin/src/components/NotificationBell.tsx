import {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useRealtimeStore} from '../store/realtimeStore';

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const {notifications, unread, markAllRead, markRead, clearNotifications} =
    useRealtimeStore();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="glass relative flex h-10 w-10 items-center justify-center rounded-xl transition hover:bg-white/80 dark:hover:bg-white/10"
        aria-label="Notifications">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-700 dark:text-slate-200"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-1 text-[10px] font-bold text-white shadow-lg animate-pop">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass-strong absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl shadow-2xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-white/20 px-4 py-3 dark:border-white/10">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Notifications
            </p>
            <div className="flex gap-2 text-xs">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="font-medium text-slate-400 hover:underline">
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                You're all caught up 🎉
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    markRead(n.id);
                    if (n.link) {
                      navigate(n.link);
                      setOpen(false);
                    }
                  }}
                  className={`flex w-full items-start gap-3 border-b border-white/10 px-4 py-3 text-left transition last:border-0 hover:bg-white/40 dark:hover:bg-white/5 ${!n.read ? 'bg-blue-500/5' : ''}`}>
                  <span className="mt-0.5 text-lg">{n.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {timeAgo(n.at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
