import {Outlet, NavLink, useNavigate} from 'react-router-dom';
import {useAuthStore} from '../store/authStore';

const nav = [
  {to: '/', label: 'Dashboard', icon: '📊'},
  {to: '/chat', label: 'Chat', icon: '💬'},
  {to: '/users', label: 'Users', icon: '👥'},
  {to: '/groups', label: 'Groups', icon: '👪'},
  {to: '/posts', label: 'Posts', icon: '📰'},
  {to: '/health', label: 'Health', icon: '💚'},
  {to: '/settings', label: 'Settings', icon: '⚙️'},
  {to: '/admins', label: 'Admins', icon: '🛡️'},
];

export function Layout() {
  const {admin, logout} = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-xl font-bold">گفتگو Admin</h1>
          <p className="text-xs text-gray-400 mt-1">Management Panel</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({isActive}) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`
              }>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <div className="text-sm text-gray-300 mb-2">{admin?.displayName}</div>
          <div className="text-xs text-gray-500 mb-3">{admin?.role}</div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm text-white transition-colors">
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
