import {useEffect, useState} from 'react';
import {api} from '../api/client';

function StatCard({
  label,
  value,
  icon,
  color = 'primary',
}: {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}) {
  const colors: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-primary-50 text-primary-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([api.getStats(), api.getHealth()])
      .then(([statsResult, healthResult]) => {
        if (statsResult.status === 'fulfilled') setStats(statsResult.value);
        if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading dashboard...</div>;
  if (!stats)
    return <div className="text-red-500">Failed to load dashboard</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Users" value={stats.users?.total || 0} icon="👥" />
        <StatCard
          label="Online"
          value={stats.users?.online || 0}
          icon="🟢"
          color="green"
        />
        <StatCard
          label="Messages Today"
          value={stats.messages?.today || 0}
          icon="💬"
        />
        <StatCard
          label="New Users Today"
          value={stats.users?.newToday || 0}
          icon="🆕"
          color="green"
        />
        <StatCard label="Groups" value={stats.groups?.total || 0} icon="👪" />
        <StatCard
          label="Posts"
          value={stats.posts?.total || 0}
          icon="📰"
          color="purple"
        />
        <StatCard
          label="Pending Posts"
          value={stats.posts?.pending || 0}
          icon="⏳"
          color="yellow"
        />
        <StatCard
          label="Friend Requests"
          value={stats.friends?.pendingRequests || 0}
          icon="🤝"
          color="purple"
        />
        <StatCard
          label="Suspended"
          value={stats.users?.suspended || 0}
          icon="🚫"
          color="red"
        />
        <StatCard
          label="Nearby Active"
          value={stats.nearby?.active || 0}
          icon="📡"
          color="yellow"
        />
        <StatCard
          label="Files Today"
          value={stats.messages?.filesToday || 0}
          icon="📁"
          color="purple"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          System Health
        </h2>
        <div className="space-y-2">
          {health?.checks?.map((check: any) => (
            <div
              key={check.name}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-700">{check.name}</span>
              <span
                className={`text-sm font-medium ${check.status === 'ok' ? 'text-green-600' : check.status === 'warning' ? 'text-yellow-600' : 'text-red-600'}`}>
                {check.status === 'ok'
                  ? '🟢'
                  : check.status === 'warning'
                    ? '🟡'
                    : '🔴'}{' '}
                {check.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
