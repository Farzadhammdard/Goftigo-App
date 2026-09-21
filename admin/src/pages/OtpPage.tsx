import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { PageHeader, Button, Badge } from '../components/ui';

function fmt(ts: number) {
  return new Date(ts).toLocaleString('fa-IR');
}

function remaining(expiresAt: number) {
  const d = expiresAt - Date.now();
  if (d <= 0) return 'منقضی';
  const m = Math.floor(d / 60000);
  const s = Math.floor((d % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function OtpPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [, tick] = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), pageSize: '50' };
      if (search) params.search = search;
      const res: any = await api.getOtps(params);
      setRows(res.data || []);
      setMeta(res.meta || null);
    } catch (e: any) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(true), 5000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);
  useEffect(() => {
    const id = setInterval(() => tick(v => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const copy = async (code: string, id: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(id); setTimeout(() => setCopied(null), 1500); } catch {}
  };

  const handleCleanup = async () => {
    if (!confirm('کدهای منقضی و استفاده‌شده حذف شوند؟')) return;
    try { await api.cleanupOtps(); load(); } catch (e: any) { alert(e.message); }
  };

  const handleDelete = async (id: string, phone: string) => {
    if (!confirm(`کد ${phone} حذف شود؟`)) return;
    try { await api.deleteOtp(id); load(true); } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="کدهای OTP"
        subtitle="کد تایید شماره تلفن — وقتی کاربر در اپ شماره را وارد می‌کند کد اینجا ظاهر می‌شود. کاربر با وارد کردن همین کد لاگین می‌شود و اکانتش باز می‌شود."
        right={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
              بروزرسانی خودکار
            </label>
            <Button variant="ghost" onClick={() => load()}>↻ بروزرسانی</Button>
            <Button variant="ghost" onClick={handleCleanup}>حذف منقضی‌ها</Button>
          </div>
        }
      />

      <form onSubmit={handleSearch} className="glass flex items-center gap-2 rounded-2xl p-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="جستجو: شماره، کد، sessionId..."
          className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
        />
        <Button type="submit">جستجو</Button>
      </form>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/40 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-right">شماره واقعی</th>
                <th className="px-4 py-3 text-right">کد</th>
                <th className="px-4 py-3 text-right">Session</th>
                <th className="px-4 py-3 text-right">وضعیت</th>
                <th className="px-4 py-3 text-right">مانده</th>
                <th className="px-4 py-3 text-right">ایجاد</th>
                <th className="px-4 py-3 text-right">انقضا</th>
                <th className="px-4 py-3 text-right">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">در حال بارگذاری...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">هنوز کدی ثبت نشده — در اپ روی «ارسال کد» بزنید</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="hover:bg-white/30 dark:hover:bg-white/5">
                  <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-100" dir="ltr">{r.phoneNumber}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-indigo-600 px-3 py-1.5 font-mono text-base font-bold tracking-[0.3em] text-white">{r.code}</span>
                      <button
                        onClick={() => copy(r.code, r.id)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50 dark:border-white/10 dark:bg-white/10"
                        title="کپی"
                      >
                        {copied === r.id ? '✓' : 'کپی'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500" title={r.sessionId}>{r.sessionId.slice(0, 8)}…</td>
                  <td className="px-4 py-3">
                    {r.status === 'valid' && <Badge tone="success">معتبر</Badge>}
                    {r.status === 'used' && <Badge tone="neutral">استفاده‌شده</Badge>}
                    {r.status === 'expired' && <Badge tone="danger">منقضی</Badge>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.status === 'valid' ? remaining(r.expiresAt) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{fmt(r.expiresAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(r.id, r.phoneNumber)}
                      className="rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-600"
                      title="حذف این کد"
                    >
                      ✕ حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta && (
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-xs text-slate-500">
            <span>مجموع: {meta.total} — صفحه {meta.page} از {meta.totalPages}</span>
            <div className="flex gap-1">
              <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>قبلی</Button>
              <Button variant="ghost" disabled={page >= meta.totalPages} onClick={() => setPage(p => p + 1)}>بعدی</Button>
            </div>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-4 text-xs leading-6 text-slate-500">
        <p className="font-semibold text-slate-700 dark:text-slate-200">چگونه کار می‌کند؟</p>
        <ol className="list-decimal pr-5">
          <li>کاربر در اپ شماره مثل <span dir="ltr">+93700000000</span> را وارد و «ارسال کد» می‌زند → <code>POST /api/auth/send-otp</code></li>
          <li>کد ۶ رقمی اینجا ظاهر می‌شود (۵ دقیقه اعتبار، وضعیت «معتبر»)</li>
          <li>همین کد را در اپ وارد کند → <code>POST /api/auth/verify-otp</code> → اگر درست بود اکانت ساخته/باز می‌شود و <code>accessToken</code> برمی‌گردد</li>
          <li>بعد از تایید، وضعیت به «استفاده‌شده» تغییر می‌کند</li>
        </ol>
      </div>
    </div>
  );
}
