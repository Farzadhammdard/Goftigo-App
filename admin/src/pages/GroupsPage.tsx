import {useEffect, useState} from 'react';
import {api} from '../api/client';

export function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({name: '', description: ''});

  const load = async () => {
    setLoading(true);
    try { const r = await api.getGroups(); setGroups(r.data); } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.createGroup(form); setShowCreate(false); setForm({name: '', description: ''}); load(); } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this group?')) return;
    try { await api.deleteGroup(id); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          + Create Group
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold mb-3">New Group</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              placeholder="Group name" className="w-full px-3 py-2 border rounded-lg text-sm" required />
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              placeholder="Description (optional)" className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
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
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Group</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Members</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr> :
              groups.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No groups</td></tr> :
              groups.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{g.name}</div>
                    {g.description && <div className="text-xs text-gray-500">{g.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{g.memberCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(g.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(g.id)} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">Delete</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
