import {useEffect, useState} from 'react';
import {api} from '../api/client';

export function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {page: String(page), pageSize: '20'};
      if (status) params.status = status;
      const r = await api.getPosts(params);
      setPosts(r.data); setMeta(r.meta);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, status]);

  const handleStatus = async (id: string, s: string) => {
    if (!confirm(`Set post status to ${s}?`)) return;
    try { await api.updatePostStatus(id, s); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Posts</h1>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 flex gap-3 border-b border-gray-200">
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
            <option value="hidden">Hidden</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Author</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Content</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Likes</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr> :
              posts.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No posts</td></tr> :
              posts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{p.authorName} <span className="text-gray-400">@{p.authorUsername}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                    {p.imageUrl && <img src={p.imageUrl} alt="Post attachment" className="w-16 h-16 object-cover rounded mb-1" />}
                    <span className="block max-w-xs truncate">{p.caption || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">{p.likeCount}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      p.status === 'active' ? 'bg-green-100 text-green-700' :
                      p.status === 'pending' ? 'bg-blue-100 text-blue-700' :
                      p.status === 'rejected' ? 'bg-orange-100 text-orange-700' :
                      p.status === 'hidden' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right flex gap-1 justify-end">
                    {p.status === 'pending' && <>
                      <button onClick={() => handleStatus(p.id, 'active')} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded">Approve</button>
                      <button onClick={() => handleStatus(p.id, 'rejected')} className="px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded">Reject</button>
                    </>}
                    {p.status === 'active' && <button onClick={() => handleStatus(p.id, 'hidden')} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded">Hide</button>}
                    {p.status === 'hidden' && <button onClick={() => handleStatus(p.id, 'active')} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded">Restore</button>}
                    <button onClick={() => handleStatus(p.id, 'deleted')} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded">Delete</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {meta && (
          <div className="p-4 flex items-center justify-between border-t border-gray-200">
            <span className="text-sm text-gray-500">{meta.total} total</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Prev</button>
              <span className="px-3 py-1 text-sm">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={!meta.hasMore} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
