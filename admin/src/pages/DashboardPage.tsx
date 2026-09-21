import {useEffect, useState, useCallback} from 'react';
import {api} from '../api/client';
import {useRealtimeStore} from '../store/realtimeStore';
import {StatCard, GlassCard, PageHeader, Badge} from '../components/ui';

export function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const eventVersion = useRealtimeStore(s => s.eventVersion);
  const presenceVersion = useRealtimeStore(s => s.presenceVersion);
  const lastEvent = useRealtimeStore(s => s.lastEvent);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [statsResult, healthResult] = await Promise.allSettled([
      api.getStats(),
      api.getHealth(),
    ]);
    if (statsResult.status === 'fulfilled') setStats(statsResult.value);
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live refresh whenever anything happens across the platform.
  useEffect(() => {
    if (eventVersion > 0) load(true);
  }, [eventVersion, load]);

  useEffect(() => {
    if (presenceVersion > 0) load(true);
  }, [presenceVersion, load]);

  if (loading && !stats) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Live overview of Goftgoo" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({length: 8}).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats)
    return (
      <div className="text-rose-500">Failed to load dashboard metrics.</div>
    );

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Dashboard"
        subtitle="Live overview — updates automatically as things happen"
        right={
          lastEvent ? (
            <Badge tone="blue">
              <span className="live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 text-blue-500" />
              Last: {lastEvent.title}
            </Badge>
          ) : null
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Users" value={stats.users?.total || 0} icon="👥" color="blue" />
        <StatCard label="Online Now" value={stats.users?.online || 0} icon="🟢" color="green" />
        <StatCard label="Messages Today" value={stats.messages?.today || 0} icon="💬" color="purple" />
        <StatCard label="New Users Today" value={stats.users?.newToday || 0} icon="🆕" color="green" />
        <StatCard label="Groups" value={stats.groups?.total || 0} icon="👪" color="blue" />
        <StatCard label="Posts" value={stats.posts?.total || 0} icon="📰" color="purple" />
        <StatCard label="Pending Posts" value={stats.posts?.pending || 0} icon="⏳" color="yellow" />
        <StatCard label="Friend Requests" value={stats.friends?.pendingRequests || 0} icon="🤝" color="purple" />
        <StatCard label="Suspended" value={stats.users?.suspended || 0} icon="🚫" color="red" />
        <StatCard label="Nearby Active" value={stats.nearby?.active || 0} icon="📡" color="yellow" />
        <StatCard label="Files Today" value={stats.messages?.filesToday || 0} icon="📁" color="purple" />
      </div>

      <GlassCard className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            System Health
          </h2>
          <span className="text-xs text-slate-400">auto-refreshing</span>
        </div>
        <div className="space-y-1">
          {health?.checks?.map((check: any) => (
            <div
              key={check.name}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 transition hover:bg-white/40 dark:hover:bg-white/5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {check.name}
              </span>
              <span
                className={`text-sm ${
                  check.status === 'ok'
                    ? 'text-emerald-500'
                    : check.status === 'warning'
                      ? 'text-amber-500'
                      : 'text-rose-500'
                }`}>
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
      </GlassCard>
    </div>
  );
}
