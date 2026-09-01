import {useEffect, useState} from 'react';
import {api} from '../api/client';

export function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter) params.status = filter;
      const r = await api.getReports(params);
      setReports(r?.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const handleUpdate = async (id: string, status: string) => {
    try { await api.updateReport(id, {status}); load(); } catch (e: any) { alert(e.message); }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 flex gap-3 border-b border-gray-200">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reporter</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Target</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr> :
              reports.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No reports</td></tr> :
              reports.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{r.reporterName || 'Unknown'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.targetType}: {r.targetId?.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{r.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      r.status === 'open' ? 'bg-red-100 text-red-700' :
                      r.status === 'investigating' ? 'bg-yellow-100 text-yellow-700' :
                      r.status === 'resolved' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right flex gap-1 justify-end">
                    {r.status === 'open' && <button onClick={() => handleUpdate(r.id, 'investigating')} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded">Investigate</button>}
                    {r.status !== 'resolved' && <button onClick={() => handleUpdate(r.id, 'resolved')} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded">Resolve</button>}
                    {r.status !== 'rejected' && <button onClick={() => handleUpdate(r.id, 'rejected')} className="px-2 py-1 text-xs bg-gray-50 text-gray-700 rounded">Reject</button>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
