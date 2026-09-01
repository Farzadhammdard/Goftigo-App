import {useEffect, useState} from 'react';
import {api} from '../api/client';

export function AdminsPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({email: '', username: '', password: '', displayName: '', role: 'support'});

  const load = async () => {
    setLoading(true);
    try { setAdmins(await api.getAdmins()); } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.createAdmin(form); setShowCreate(false); setForm({email: '', username: '', password: '', displayName: '', role: 'support'}); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Administrators</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          + Add Admin
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold mb-3">New Administrator</h3>
          <form onSubmit={handleCreate} className="space-y-3 max-w-md">
            <input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} placeholder="Display Name" className="w-full px-3 py-2 border rounded-lg text-sm" required />
            <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" type="email" className="w-full px-3 py-2 border rounded-lg text-sm" required />
            <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder="Username" className="w-full px-3 py-2 border rounded-lg text-sm" required />
            <input value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Password" type="password" className="w-full px-3 py-2 border rounded-lg text-sm" required />
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="support">Support</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Administrator</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Create</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Admin</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Last Login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr> :
              admins.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{a.displayName}</div>
                    <div className="text-xs text-gray-500">{a.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      a.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                      a.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                      a.role === 'moderator' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{a.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${a.isActive ? 'text-green-600' : 'text-red-600'}`}>
                      {a.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'Never'}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
