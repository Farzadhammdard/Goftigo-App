import {useEffect, useMemo} from 'react';
import {Outlet, NavLink, useNavigate} from 'react-router-dom';
import {useAuthStore} from '../store/authStore';
import {useThemeStore} from '../store/themeStore';
import {useRealtimeStore} from '../store/realtimeStore';
import {NotificationBell} from './NotificationBell';
import {Toasts} from './Toasts';
import {Avatar} from './ui';

const nav = [
  {to: '/', label: 'Dashboard', icon: '📊'},
  {to: '/chat', label: 'Chat', icon: '💬', badge: 'chat'},
  {to: '/users', label: 'Users', icon: '👥'},
  {to: '/groups', label: 'Groups', icon: '👪'},
  {to: '/posts', label: 'Posts', icon: '📰', badge: 'posts'},
  {to: '/health', label: 'Health', icon: '💚'},
  {to: '/otp', label: 'OTP Codes', icon: '🔑'},
  {to: '/settings', label: 'Settings', icon: '⚙️'},
  {to: '/admins', label: 'Admins', icon: '🛡️'},
];

function ThemeToggle() {
  const {theme, toggle} = useThemeStore();
  return (
    <button
      onClick={toggle}
      className="glass relative flex h-10 w-[68px] items-center rounded-full px-1 transition"
      aria-label="Toggle theme">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br shadow-md transition-transform duration-300 ${
          theme === 'dark'
            ? 'translate-x-[28px] from-indigo-500 to-slate-700'
            : 'translate-x-0 from-amber-400 to-orange-500'
        }`}>
        <span className="text-sm">{theme === 'dark' ? '🌙' : '☀️'}</span>
      </span>
    </button>
  );
}

export function Layout() {
  const {admin, logout} = useAuthStore();
  const navigate = useNavigate();
  const connected = useRealtimeStore(s => s.connected);
  const init = useRealtimeStore(s => s.init);
  const teardown = useRealtimeStore(s => s.teardown);
  const notifications = useRealtimeStore(s => s.notifications);

  // Establish the single global realtime connection for the whole panel.
  useEffect(() => {
    init();
    return () => teardown();
  }, [init, teardown]);

  const unreadByKind = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notifications) {
      if (n.read) continue;
      if (n.kind === 'message.new') counts.chat = (counts.chat || 0) + 1;
      if (n.kind === 'post.created') counts.posts = (counts.posts || 0) + 1;
    }
    return counts;
  }, [notifications]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="relative flex h-screen overflow-hidden text-slate-900 dark:text-slate-100">
      <div className="app-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      {/* Sidebar */}
      <aside className="glass-strong z-10 flex w-64 shrink-0 flex-col border-r border-white/20 dark:border-white/10">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-lg shadow-lg shadow-blue-600/30">
            💬
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-900 dark:text-white">
              Goftgoo
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Admin Panel
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {nav.map(item => {
            const badge = item.badge ? unreadByKind[item.badge] : 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({isActive}) =>
                  `nav-link ${isActive ? 'active' : ''}`
                }>
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {badge ? (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {badge > 9 ? '9+' : badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/20 p-3 dark:border-white/10">
          <div className="glass flex items-center gap-3 rounded-2xl p-3">
            <Avatar
              src={admin?.avatarUrl}
              name={admin?.displayName || 'A'}
              size={38}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                {admin?.displayName}
              </p>
              <p className="truncate text-[11px] capitalize text-slate-500 dark:text-slate-400">
                {admin?.role}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-500">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="z-10 flex flex-1 flex-col overflow-hidden">
        <header className="glass-strong flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/20 px-6 dark:border-white/10">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                connected
                  ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                  : 'border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300'
              }`}>
              <span
                className={`h-2 w-2 rounded-full ${connected ? 'live-dot bg-emerald-500 text-emerald-500' : 'bg-rose-500'}`}
              />
              {connected ? 'Live' : 'Connecting…'}
            </span>
            <span className="hidden text-xs text-slate-400 sm:inline">
              Real-time updates on — no refresh needed
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>

      <Toasts />
    </div>
  );
}
