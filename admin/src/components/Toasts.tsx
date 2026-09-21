import {useNavigate} from 'react-router-dom';
import {useRealtimeStore, AdminEvent, EventLevel} from '../store/realtimeStore';

const levelStyles: Record<EventLevel, string> = {
  info: 'border-blue-400/40',
  success: 'border-emerald-400/40',
  warning: 'border-amber-400/40',
  danger: 'border-rose-400/40',
};

const levelAccent: Record<EventLevel, string> = {
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

function Toast({event}: {event: AdminEvent}) {
  const dismiss = useRealtimeStore(s => s.dismissToast);
  const navigate = useNavigate();

  return (
    <div
      onClick={() => {
        if (event.link) navigate(event.link);
        dismiss(event.id);
      }}
      className={`glass-strong pointer-events-auto relative flex w-80 cursor-pointer items-start gap-3 overflow-hidden rounded-2xl border p-3.5 shadow-2xl animate-toast-in ${levelStyles[event.level]}`}>
      <span
        className={`absolute left-0 top-0 h-full w-1 ${levelAccent[event.level]}`}
      />
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/40 text-lg dark:bg-white/10">
        {event.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {event.title}
          </p>
          <span className="shrink-0 text-[10px] text-slate-400">
            {timeAgo(event.at)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
          {event.body}
        </p>
      </div>
      <button
        onClick={e => {
          e.stopPropagation();
          dismiss(event.id);
        }}
        className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-white/50 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

export function Toasts() {
  const toasts = useRealtimeStore(s => s.toasts);
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2.5">
      {toasts.map(t => (
        <Toast key={t.id} event={t} />
      ))}
    </div>
  );
}
