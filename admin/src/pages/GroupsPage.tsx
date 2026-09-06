import {useEffect, useState} from 'react';
import {api} from '../api/client';

export function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({name: '', description: ''});

  const load = async (searchOverride = search) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {page: String(page), pageSize: '20'};
      if (searchOverride) params.search = searchOverride;
      const r = await api.getGroups(params);
      setGroups(r.data || []);
      setMeta(r.meta);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.createGroup(form); setShowCreate(false); setForm({name: '', description: ''}); load(); } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this group?')) return;
    try { await api.deleteGroup(id); load(); } catch (e: any) { alert(e.message); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.updateGroup(editing.id, form); setEditing(null); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <div className="flex gap-2">
          <form onSubmit={e => { e.preventDefault(); setPage(1); load(search); }} className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search groups"
              className="px-3 py-2 border rounded-lg text-sm" />
            <button className="px-3 py-2 border rounded-lg text-sm">Search</button>
          </form>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">+ Create Group</button>
        </div>
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

      {editing && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold mb-3">Edit Group</h3>
          <form onSubmit={handleEdit} className="space-y-3">
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" required />
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm">Save</button>
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">Cancel</button>
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
                    <button onClick={() => { setEditing(g); setForm({name: g.name, description: g.description || ''}); setShowCreate(false); }}
                      className="px-2 py-1 mr-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">Edit</button>
                    <button onClick={() => handleDelete(g.id)} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">Delete</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {meta && <div className="p-4 flex items-center justify-between border-t border-gray-200">
          <span className="text-sm text-gray-500">{meta.total} total groups</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Prev</button>
            <span className="px-3 py-1 text-sm">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={!meta.hasMore} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Next</button>
          </div>
        </div>}
      </div>
    </div>
  );
}
