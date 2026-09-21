import {useEffect, useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {api} from '../api/client';
import {GlassCard, Badge, Avatar} from '../components/ui';

function InfoTile({label, value}: {label: string; value: React.ReactNode}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

export function UserDetailPage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api
      .getUser(id)
      .then(setUser)
      .catch(() => navigate('/users'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return (
      <div className="max-w-2xl">
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    );
  if (!user)
    return (
      <div className="text-rose-500" style={{color: 'var(--text)'}}>
        User not found
      </div>
    );

  return (
    <div className="max-w-2xl animate-fade-up">
      <button
        onClick={() => navigate('/users')}
        className="mb-4 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
        &larr; Back to Users
      </button>
      <GlassCard className="p-6">
        <div className="mb-6 flex items-center gap-4">
          <Avatar src={user.avatarUrl} name={user.displayName} size={64} />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {user.displayName}
            </h1>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              @{user.username}
            </div>
            <div className="font-mono text-xs text-slate-400">{user.id}</div>
          </div>
          <div className="ml-auto">
            <Badge
              tone={
                user.status === 'active'
                  ? 'green'
                  : user.status === 'suspended'
                    ? 'yellow'
                    : 'red'
              }>
              {user.status}
            </Badge>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4">
          <InfoTile label="Phone" value={user.phoneNumber} />
          <InfoTile label="Employee ID" value={user.employeeId || '—'} />
          <InfoTile label="Groups" value={user.stats?.groupCount || 0} />
          <InfoTile label="Posts" value={user.stats?.postCount || 0} />
          <InfoTile label="Messages Sent" value={user.stats?.messageCount || 0} />
          <InfoTile
            label="Joined"
            value={new Date(user.createdAt).toLocaleDateString()}
          />
        </div>

        {user.devices?.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">
              Devices
            </h3>
            <div className="space-y-2">
              {user.devices.map((d: any) => (
                <div
                  key={d.id}
                  className="glass flex items-center justify-between rounded-xl p-3">
                  <div>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {d.deviceType}
                    </span>
                    {d.osVersion && (
                      <span className="ml-2 text-xs text-slate-500">
                        {d.osVersion}
                      </span>
                    )}
                    {d.appVersion && (
                      <span className="ml-2 text-xs text-slate-400">
                        v{d.appVersion}
                      </span>
                    )}
                  </div>
                  <Badge tone={d.isActive ? 'green' : 'gray'}>
                    {d.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
