import {useEffect, useState} from 'react';
import {api} from '../api/client';

export function HealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getHealth().then(setHealth).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">System Health</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`text-lg font-semibold ${health?.overallStatus === 'healthy' ? 'text-green-600' : 'text-yellow-600'}`}>
            {health?.overallStatus === 'healthy' ? '🟢 System Healthy' : '🟡 Partial'}
          </div>
        </div>
        <div className="space-y-3">
          {health?.checks?.map((check: any) => (
            <div key={check.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-gray-900">{check.name}</div>
                <div className="text-xs text-gray-500">{check.message}</div>
              </div>
              <span className="text-lg">
                {check.status === 'ok' ? '🟢' : check.status === 'warning' ? '🟡' : '🔴'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
