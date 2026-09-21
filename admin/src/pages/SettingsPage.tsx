import {useEffect, useState} from 'react';
import {api} from '../api/client';
import {PageHeader, GlassCard, Button} from '../components/ui';

export function SettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .getSettings()
      .then(s => {
        setSettings(s);
        const e: Record<string, string> = {};
        s.forEach((item: any) => {
          e[item.key] = item.value;
        });
        setEdits(e);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(edits);
      alert('Settings saved');
    } catch (e: any) {
      alert(e.message);
    }
    setSaving(false);
  };

  if (loading)
    return (
      <div>
        <PageHeader title="System Settings" />
        <div className="skeleton h-64 max-w-2xl rounded-2xl" />
      </div>
    );

  return (
    <div className="max-w-2xl animate-fade-up">
      <PageHeader title="System Settings" subtitle="Tune global app behaviour" />
      <GlassCard className="space-y-4 p-6">
        {settings.map(s => (
          <div key={s.key}>
            <label className="mb-1.5 block text-sm font-medium capitalize text-slate-700 dark:text-slate-200">
              {s.key.replace(/_/g, ' ')}
            </label>
            <input
              value={edits[s.key] || ''}
              onChange={e => setEdits({...edits, [s.key]: e.target.value})}
              className="glass-input"
            />
          </div>
        ))}
        <Button onClick={handleSave} disabled={saving} className="mt-2">
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </GlassCard>
    </div>
  );
}
