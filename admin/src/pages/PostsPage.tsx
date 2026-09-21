import {useEffect, useState, useCallback} from 'react';
import {api} from '../api/client';
import {useRealtimeStore} from '../store/realtimeStore';
import {PageHeader, Button, Badge} from '../components/ui';

const statusTone: Record<string, string> = {
  active: 'green',
  pending: 'blue',
  rejected: 'yellow',
  hidden: 'yellow',
  deleted: 'red',
};

export function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const eventVersion = useRealtimeStore(s => s.eventVersion);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params: Record<string, string> = {
          page: String(page),
          pageSize: '20',
        };
        if (status) params.status = status;
        const r = await api.getPosts(params);
        setPosts(r.data);
        setMeta(r.meta);
      } catch (e) {
        console.error(e);
      }
      if (!silent) setLoading(false);
    },
    [page, status],
  );

  useEffect(() => {
    load();
  }, [page, status, load]);

  // Live: a new post submitted anywhere refreshes this list instantly.
  useEffect(() => {
    if (eventVersion > 0) load(true);
  }, [eventVersion]);

  const handleStatus = async (id: string, s: string) => {
    if (!confirm(`Set post status to ${s}?`)) return;
    try {
      await api.updatePostStatus(id, s);
      load();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Posts"
        subtitle={meta ? `${meta.total} total posts` : undefined}
      />

      <div className="glass-card overflow-hidden">
        <div className="flex gap-3 border-b border-white/20 p-4 dark:border-white/10">
          <select
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="glass-input w-auto">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
            <option value="hidden">Hidden</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-white/20 bg-white/20 dark:border-white/10 dark:bg-white/5">
              <tr>
                {['Author', 'Content', 'Likes', 'Status', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${i === 4 ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    No posts
                  </td>
                </tr>
              ) : (
                posts.map(p => (
                  <tr
                    key={p.id}
                    className="transition hover:bg-white/30 dark:hover:bg-white/5">
                    <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200">
                      {p.authorName}{' '}
                      <span className="text-slate-400">@{p.authorUsername}</span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {p.imageUrl && (
                        <img
                          src={p.imageUrl}
                          alt=""
                          className="mb-1 h-16 w-16 rounded-lg object-cover"
                        />
                      )}
                      <span className="block max-w-xs truncate">
                        {p.caption || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {p.likeCount}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone[p.status] || 'gray'}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {p.status === 'pending' && (
                          <>
                            <ActionBtn tone="green" onClick={() => handleStatus(p.id, 'active')}>
                              Approve
                            </ActionBtn>
                            <ActionBtn tone="yellow" onClick={() => handleStatus(p.id, 'rejected')}>
                              Reject
                            </ActionBtn>
                          </>
                        )}
                        {p.status === 'active' && (
                          <ActionBtn tone="yellow" onClick={() => handleStatus(p.id, 'hidden')}>
                            Hide
                          </ActionBtn>
                        )}
                        {p.status === 'hidden' && (
                          <ActionBtn tone="green" onClick={() => handleStatus(p.id, 'active')}>
                            Restore
                          </ActionBtn>
                        )}
                        <ActionBtn tone="red" onClick={() => handleStatus(p.id, 'deleted')}>
                          Delete
                        </ActionBtn>
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
              {meta.total} total
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

function ActionBtn({
  tone,
  onClick,
  children,
}: {
  tone: 'green' | 'yellow' | 'red';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    green:
      'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-300',
    yellow:
      'bg-amber-500/15 text-amber-600 hover:bg-amber-500/25 dark:text-amber-300',
    red: 'bg-rose-500/15 text-rose-600 hover:bg-rose-500/25 dark:text-rose-300',
  };
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${tones[tone]}`}>
      {children}
    </button>
  );
}
