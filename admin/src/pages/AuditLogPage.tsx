import {useEffect, useState} from 'react';
import {api} from '../api/client';

export function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.getAuditLog({page: String(page), pageSize: '50'});
      setLogs(r.data); setMeta(r.meta);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Audit Log</h1>
      <div className="bg-white rounded-xl border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Admin</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Target</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Result</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr> :
              logs.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No logs</td></tr> :
              logs.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{l.adminName || 'Unknown'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{l.action}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{l.targetType && `${l.targetType}: `}{l.targetName || l.targetId?.slice(0, 8) || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${l.result === 'success' ? 'text-green-600' : 'text-red-600'}`}>{l.result}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {meta && (
          <div className="p-4 flex items-center justify-between border-t border-gray-200">
            <span className="text-sm text-gray-500">{meta.total} total entries</span>
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
