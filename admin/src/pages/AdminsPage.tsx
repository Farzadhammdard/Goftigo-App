import {useEffect, useState} from 'react';
import {api} from '../api/client';
import {PageHeader, Button, Badge, Avatar} from '../components/ui';

const roleTone: Record<string, string> = {
  super_admin: 'purple',
  admin: 'blue',
  moderator: 'green',
  support: 'gray',
};

export function AdminsPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    displayName: '',
    role: 'support',
  });

  const load = async () => {
    setLoading(true);
    try {
      setAdmins(await api.getAdmins());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAdmin(form);
      setShowCreate(false);
      setForm({
        email: '',
        username: '',
        password: '',
        displayName: '',
        role: 'support',
      });
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Administrators"
        subtitle="Manage panel access and roles"
        right={<Button onClick={() => setShowCreate(true)}>+ Add Admin</Button>}
      />

      {showCreate && (
        <div className="glass-card mb-6 p-6">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">
            New Administrator
          </h3>
          <form onSubmit={handleCreate} className="max-w-md space-y-3">
            <input
              value={form.displayName}
              onChange={e => setForm({...form, displayName: e.target.value})}
              placeholder="Display Name"
              className="glass-input"
              required
            />
            <input
              value={form.email}
              onChange={e => setForm({...form, email: e.target.value})}
              placeholder="Email"
              type="email"
              className="glass-input"
              required
            />
            <input
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
              placeholder="Username"
              className="glass-input"
              required
            />
            <input
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              placeholder="Password"
              type="password"
              className="glass-input"
              required
            />
            <select
              value={form.role}
              onChange={e => setForm({...form, role: e.target.value})}
              className="glass-input">
              <option value="support">Support</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Administrator</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button type="button" variant="soft" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-white/20 bg-white/20 dark:border-white/10 dark:bg-white/5">
            <tr>
              {['Admin', 'Role', 'Status', 'Last Login'].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : (
              admins.map(a => (
                <tr
                  key={a.id}
                  className="transition hover:bg-white/30 dark:hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={a.displayName} size={36} />
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {a.displayName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {a.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={roleTone[a.role] || 'gray'}>{a.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={a.isActive ? 'green' : 'red'}>
                      {a.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                    {a.lastLoginAt
                      ? new Date(a.lastLoginAt).toLocaleString()
                      : 'Never'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
