import {useEffect, useState} from 'react';
import {api} from '../api/client';
import {PageHeader, GlassCard, Badge} from '../components/ui';

export function HealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      api
        .getHealth()
        .then(setHealth)
        .catch(console.error)
        .finally(() => setLoading(false));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (loading && !health)
    return (
      <div>
        <PageHeader title="System Health" />
        <div className="skeleton h-64 max-w-2xl rounded-2xl" />
      </div>
    );

  const healthy = health?.overallStatus === 'healthy';

  return (
    <div className="max-w-2xl animate-fade-up">
      <PageHeader
        title="System Health"
        subtitle="Auto-refreshes every 15 seconds"
        right={
          <Badge tone={healthy ? 'green' : 'yellow'}>
            {healthy ? '🟢 Healthy' : '🟡 Partial'}
          </Badge>
        }
      />
      <GlassCard className="p-6">
        <div className="space-y-3">
          {health?.checks?.map((check: any) => (
            <div
              key={check.name}
              className="glass flex items-center justify-between rounded-xl p-3.5">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {check.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {check.message}
                </div>
              </div>
              <span className="text-lg">
                {check.status === 'ok'
                  ? '🟢'
                  : check.status === 'warning'
                    ? '🟡'
                    : '🔴'}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
