import {useEffect, useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {api} from '../api/client';

export function UserDetailPage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getUser(id).then(setUser).catch(() => navigate('/users')).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-500">Loading...</div>;
  if (!user) return <div className="text-red-500">User not found</div>;

  return (
    <div className="max-w-2xl">
      <button onClick={() => navigate('/users')} className="text-sm text-primary-600 hover:underline mb-4">&larr; Back to Users</button>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-2xl font-bold">
            {user.displayName?.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{user.displayName}</h1>
            <div className="text-sm text-gray-500">@{user.username}</div>
            <div className="text-xs text-gray-400 font-mono">{user.id}</div>
          </div>
          <div className="ml-auto">
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
              user.status === 'active' ? 'bg-green-100 text-green-700' :
              user.status === 'suspended' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>{user.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Phone</div>
            <div className="text-sm font-medium">{user.phoneNumber}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Employee ID</div>
            <div className="text-sm font-medium">{user.employeeId || '—'}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Groups</div>
            <div className="text-sm font-medium">{user.stats?.groupCount || 0}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Posts</div>
            <div className="text-sm font-medium">{user.stats?.postCount || 0}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Messages Sent</div>
            <div className="text-sm font-medium">{user.stats?.messageCount || 0}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Joined</div>
            <div className="text-sm font-medium">{new Date(user.createdAt).toLocaleDateString()}</div>
          </div>
        </div>

        {user.devices?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Devices</h3>
            <div className="space-y-2">
              {user.devices.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium">{d.deviceType}</span>
                    {d.osVersion && <span className="text-xs text-gray-500 ml-2">{d.osVersion}</span>}
                    {d.appVersion && <span className="text-xs text-gray-400 ml-2">v{d.appVersion}</span>}
                  </div>
                  <span className={`text-xs ${d.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                    {d.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
