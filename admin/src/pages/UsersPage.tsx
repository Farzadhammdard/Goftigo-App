import {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../api/client';

export function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async (searchOverride = search) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {page: String(page), pageSize: '20'};
      if (searchOverride) params.search = searchOverride;
      if (status) params.status = status;
      const result = await api.getUsers(params);
      setUsers(result.data);
      setMeta(result.meta);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, status]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(search); };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    if (!confirm(`Change user status to ${newStatus}?`)) return;
    try { await api.updateUserStatus(userId, newStatus); load(); } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try { await api.deleteUser(userId); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <Link to="/users/new" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          + Create User
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="p-4 flex gap-4 items-center">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, username, phone, ID..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            <button type="submit" className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">Search</button>
          </form>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50 border-y border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Joined</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No users found</td></tr>
            ) : users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/users/${user.id}`} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-medium">
                      {user.displayName?.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                      <div className="text-xs text-gray-500">@{user.username}</div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{user.phoneNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-600 font-mono">{user.id}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    user.status === 'active' ? 'bg-green-100 text-green-700' :
                    user.status === 'suspended' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>{user.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    {user.status === 'active' ? (
                      <button onClick={() => handleStatusChange(user.id, 'suspended')} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100">Suspend</button>
                    ) : (
                      <button onClick={() => handleStatusChange(user.id, 'active')} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">Enable</button>
                    )}
                    <button onClick={() => handleDelete(user.id)} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {meta && (
          <div className="p-4 flex items-center justify-between border-t border-gray-200">
            <span className="text-sm text-gray-500">Showing {users.length} of {meta.total} users</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Prev</button>
              <span className="px-3 py-1 text-sm">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={!meta.hasMore}
                className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
