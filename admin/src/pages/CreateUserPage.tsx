import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {api} from '../api/client';
import {PageHeader, GlassCard, Button} from '../components/ui';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </label>
      {children}
    </div>
  );
}

export function CreateUserPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    phoneNumber: '+93',
    username: '',
    displayName: '',
    employeeId: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.createUser(form);
      navigate('/users');
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg animate-fade-up">
      <PageHeader title="Create User" subtitle="Manually add a new account" />
      <GlassCard className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Display Name *">
            <input
              value={form.displayName}
              onChange={e => setForm({...form, displayName: e.target.value})}
              className="glass-input"
              required
            />
          </Field>
          <Field label="Initial Password *">
            <input
              type="password"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              className="glass-input"
              minLength={4}
              required
            />
          </Field>
          <Field label="Username *">
            <input
              value={form.username}
              onChange={e =>
                setForm({
                  ...form,
                  username: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''),
                })
              }
              className="glass-input"
              placeholder="username"
              required
            />
          </Field>
          <Field label="Phone Number *">
            <input
              value={form.phoneNumber}
              onChange={e => setForm({...form, phoneNumber: e.target.value})}
              className="glass-input"
              placeholder="+93XXXXXXXXX"
              required
            />
          </Field>
          <Field label="Employee ID">
            <input
              value={form.employeeId}
              onChange={e => setForm({...form, employeeId: e.target.value})}
              className="glass-input"
              placeholder="EMP-XXX"
            />
          </Field>

          {error && (
            <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create User'}
            </Button>
            <Button type="button" variant="soft" onClick={() => navigate('/users')}>
              Cancel
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
