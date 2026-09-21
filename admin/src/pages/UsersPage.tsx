import {useEffect, useState, useCallback} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../api/client';
import {useRealtimeStore} from '../store/realtimeStore';
import {PageHeader, Button, Badge, Avatar} from '../components/ui';

export function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const eventVersion = useRealtimeStore(s => s.eventVersion);
  const onlineUsers = useRealtimeStore(s => s.onlineUsers);

  const load = useCallback(
    async (searchOverride = search, silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params: Record<string, string> = {
          page: String(page),
          pageSize: '20',
        };
        if (searchOverride) params.search = searchOverride;
        if (status) params.status = status;
        const result = await api.getUsers(params);
        setUsers(result.data);
        setMeta(result.meta);
      } catch (e) {
        console.error(e);
      }
      if (!silent) setLoading(false);
    },
    [page, search, status],
  );

  useEffect(() => {
    load();
  }, [page, status, load]);

  // Live: reload when a new user registers anywhere on the platform.
  useEffect(() => {
    if (eventVersion > 0) load(search, true);
  }, [eventVersion]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load(search);
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    if (!confirm(`Change user status to ${newStatus}?`)) return;
    try {
      await api.updateUserStatus(userId, newStatus);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await api.deleteUser(userId);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const isOnline = (u: any) => onlineUsers[u.id] ?? u.isOnline;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Users"
        subtitle={meta ? `${meta.total} total users` : undefined}
        right={
          <Link to="/users/new">
            <Button>+ Create User</Button>
          </Link>
        }
      />

      <div className="glass-card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, username, phone, ID…"
              className="glass-input flex-1"
            />
            <Button type="submit" variant="soft">
              Search
            </Button>
          </form>
          <select
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="glass-input w-auto">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-white/20 bg-white/20 dark:border-white/10 dark:bg-white/5">
              <tr>
                {['User', 'Phone', 'Online', 'Status', 'Last Seen', 'Joined', ''].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${i === 6 ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr
                    key={user.id}
                    className="transition hover:bg-white/30 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link
                        to={`/users/${user.id}`}
                        className="flex items-center gap-3">
                        <Avatar
                          src={user.avatarUrl}
                          name={user.displayName}
                          size={36}
                          online={isOnline(user)}
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {user.displayName}
                          </div>
                          <div className="text-xs text-slate-400">
                            @{user.username}
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {user.phoneNumber}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={isOnline(user) ? 'green' : 'gray'}>
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${isOnline(user) ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        />
                        {isOnline(user) ? 'Online' : 'Offline'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          user.status === 'active'
                            ? 'green'
                            : user.status === 'suspended'
                              ? 'yellow'
                              : 'red'
                        }>
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {user.lastSeenAt
                        ? new Date(user.lastSeenAt).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1.5">
                        {user.status === 'active' ? (
                          <button
                            onClick={() =>
                              handleStatusChange(user.id, 'suspended')
                            }
                            className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600 transition hover:bg-amber-500/25 dark:text-amber-300">
                            Suspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(user.id, 'active')}
                            className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-500/25 dark:text-emerald-300">
                            Enable
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-500/25 dark:text-rose-300">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && (
          <div className="flex items-center justify-between border-t border-white/20 p-4 dark:border-white/10">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Showing {users.length} of {meta.total} users
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="soft"
                className="px-3 py-1"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}>
                Prev
              </Button>
              <span className="text-sm text-slate-500">Page {page}</span>
              <Button
                variant="soft"
                className="px-3 py-1"
                onClick={() => setPage(p => p + 1)}
                disabled={!meta.hasMore}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
