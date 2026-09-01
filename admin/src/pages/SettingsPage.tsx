import {useEffect, useState} from 'react';
import {api} from '../api/client';

export function SettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    api.getSettings().then(s => {
      setSettings(s);
      const e: Record<string, string> = {};
      s.forEach((item: any) => { e[item.key] = item.value; });
      setEdits(e);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(edits);
      alert('Settings saved');
    } catch (e: any) { alert(e.message); }
    setSaving(false);
  };

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">System Settings</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {settings.map(s => (
          <div key={s.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{s.key}</label>
            <input value={edits[s.key] || ''}
              onChange={e => setEdits({...edits, [s.key]: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
        ))}
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white rounded-lg text-sm font-medium">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
