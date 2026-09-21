import {useEffect, useState, useCallback} from 'react';
import {api} from '../api/client';
import {PageHeader, Button} from '../components/ui';

export function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({name: '', description: ''});

  const load = useCallback(
    async (searchOverride = search) => {
      setLoading(true);
      try {
        const params: Record<string, string> = {
          page: String(page),
          pageSize: '20',
        };
        if (searchOverride) params.search = searchOverride;
        const r = await api.getGroups(params);
        setGroups(r.data || []);
        setMeta(r.meta);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [page, search],
  );

  useEffect(() => {
    load();
  }, [page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createGroup(form);
      setShowCreate(false);
      setForm({name: '', description: ''});
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this group?')) return;
    try {
      await api.deleteGroup(id);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateGroup(editing.id, form);
      setEditing(null);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Groups"
        subtitle={meta ? `${meta.total} total groups` : undefined}
        right={
          <div className="flex gap-2">
            <form
              onSubmit={e => {
                e.preventDefault();
                setPage(1);
                load(search);
              }}
              className="flex gap-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search groups"
                className="glass-input w-44"
              />
              <Button type="submit" variant="soft">
                Search
              </Button>
            </form>
            <Button onClick={() => setShowCreate(true)}>+ Create Group</Button>
          </div>
        }
      />

      {(showCreate || editing) && (
        <div className="glass-card mb-6 p-6">
          <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">
            {editing ? 'Edit Group' : 'New Group'}
          </h3>
          <form
            onSubmit={editing ? handleEdit : handleCreate}
            className="space-y-3">
            <input
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              placeholder="Group name"
              className="glass-input"
              required
            />
            <textarea
              value={form.description}
              onChange={e => setForm({...form, description: e.target.value})}
              placeholder="Description (optional)"
              className="glass-input resize-none"
              rows={2}
            />
            <div className="flex gap-2">
              <Button type="submit">{editing ? 'Save' : 'Create'}</Button>
              <Button
                type="button"
                variant="soft"
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                }}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/20 bg-white/20 dark:border-white/10 dark:bg-white/5">
              <tr>
                {['Group', 'Members', 'Created', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${i === 3 ? 'text-right' : 'text-left'}`}>
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
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-400">
                    No groups
                  </td>
                </tr>
              ) : (
                groups.map(g => (
                  <tr
                    key={g.id}
                    className="transition hover:bg-white/30 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {g.name}
                      </div>
                      {g.description && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {g.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {g.memberCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(g.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setEditing(g);
                          setForm({name: g.name, description: g.description || ''});
                          setShowCreate(false);
                        }}
                        className="mr-1 rounded-lg bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-500/25 dark:text-blue-300">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(g.id)}
                        className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-500/25 dark:text-rose-300">
                        Delete
                      </button>
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
              {meta.total} total groups
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
