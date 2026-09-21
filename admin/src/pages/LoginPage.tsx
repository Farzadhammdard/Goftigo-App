import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuthStore} from '../store/authStore';
import {useThemeStore} from '../store/themeStore';
import {Button} from '../components/ui';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const {login} = useAuthStore();
  const navigate = useNavigate();
  const {theme, toggle} = useThemeStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="app-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <button
        onClick={toggle}
        className="glass absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl text-lg transition hover:bg-white/80 dark:hover:bg-white/10"
        aria-label="Toggle theme">
        {theme === 'dark' ? '🌙' : '☀️'}
      </button>

      <div className="glass-strong w-full max-w-md rounded-3xl p-8 shadow-2xl animate-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-3xl shadow-lg shadow-blue-600/30">
            💬
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Goftgoo
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Admin Panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="glass-input"
              placeholder="admin@goftgoo.com"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="glass-input"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full py-2.5">
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
