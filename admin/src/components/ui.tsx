import React from 'react';

export function GlassCard({
  className = '',
  hover = false,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {hover?: boolean}) {
  return (
    <div
      className={`glass-card ${hover ? 'glass-hover' : ''} ${className}`}
      {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  green:
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  red: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  yellow:
    'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
  purple:
    'bg-violet-500/15 text-violet-600 dark:text-violet-300 border-violet-500/30',
  gray: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
};

export function Badge({
  tone = 'gray',
  children,
  className = '',
}: {
  tone?: keyof typeof badgeTones | string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeTones[tone] || badgeTones.gray} ${className}`}>
      {children}
    </span>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
}) {
  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25 hover:from-blue-500 hover:to-indigo-500',
    danger:
      'bg-gradient-to-br from-rose-600 to-red-600 text-white shadow-lg shadow-rose-600/25 hover:from-rose-500 hover:to-red-500',
    soft: 'glass text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/10',
    ghost:
      'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/10',
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}>
      {children}
    </button>
  );
}

const statGradients: Record<string, string> = {
  blue: 'from-blue-500 to-indigo-500 shadow-blue-500/30',
  green: 'from-emerald-500 to-teal-500 shadow-emerald-500/30',
  yellow: 'from-amber-500 to-orange-500 shadow-amber-500/30',
  red: 'from-rose-500 to-red-500 shadow-rose-500/30',
  purple: 'from-violet-500 to-fuchsia-500 shadow-violet-500/30',
};

export function StatCard({
  label,
  value,
  icon,
  color = 'blue',
  trend,
}: {
  label: string;
  value: string | number;
  icon: string;
  color?: keyof typeof statGradients | string;
  trend?: string;
}) {
  return (
    <div className="glass-card glass-hover p-5">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-xl shadow-lg ${statGradients[color] || statGradients.blue}`}>
          <span>{icon}</span>
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-tight text-slate-900 dark:text-white">
            {value}
          </div>
          <div className="truncate text-sm text-slate-500 dark:text-slate-400">
            {label}
          </div>
          {trend && (
            <div className="mt-0.5 text-xs font-medium text-emerald-500">
              {trend}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Spinner({className = ''}: {className?: string}) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-slate-400/40 border-t-blue-500 ${className}`}
    />
  );
}

export function EmptyState({
  icon = '📭',
  title,
  subtitle,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
        {title}
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function Avatar({
  src,
  name,
  size = 40,
  online,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  online?: boolean;
}) {
  const initials = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="relative shrink-0" style={{width: size, height: size}}>
      {src ? (
        <img
          src={src}
          alt=""
          className="rounded-full object-cover"
          style={{width: size, height: size}}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white"
          style={{width: size, height: size, fontSize: size * 0.4}}>
          {initials}
        </div>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900"
          style={{width: size * 0.3, height: size * 0.3}}
        />
      )}
    </div>
  );
}
