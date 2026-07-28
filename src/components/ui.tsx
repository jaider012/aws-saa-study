import type { ReactNode } from 'react'

// ── icons ──────────────────────────────────────────────────────────────────
const PATHS: Record<string, string> = {
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  left: 'M19 12H5M12 19l-7-7 7-7',
  right: 'M5 12h14M12 5l7 7-7 7',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  cards: 'M4 6h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8 3h10a2 2 0 0 1 2 2v10',
  clipboard: 'M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1zM6 5h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  chart: 'M3 3v18h18M7 15v3M12 9v9M17 5v13',
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  refresh: 'M21 12a9 9 0 1 1-3.5-7.1M21 3v6h-6',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  book: 'M4 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H4zM20 4h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H20z',
  chevron: 'm9 6 6 6-6 6',
  terminal: 'm5 7 5 5-5 5M13 17h6',
  minus: 'M5 12h14',
  swords: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5 18 3h3v3l-3.5 3.5M5 14l-2 2v3h3l2-2M5 19l2-2',
}

export function Icon({
  name,
  className = 'h-4 w-4',
  filled = false,
}: {
  name: keyof typeof PATHS | string
  className?: string
  filled?: boolean
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  )
}

// ── meter ──────────────────────────────────────────────────────────────────
export function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value))
  return (
    <div
      className="meter"
      role="meter"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span style={{ width: `${pct * 100}%` }} />
    </div>
  )
}

// ── stat tile ──────────────────────────────────────────────────────────────
export function Stat({
  label,
  value,
  hint,
  tone = 'plain',
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'plain' | 'good' | 'critical' | 'accent'
}) {
  const toneClass =
    tone === 'good' ? 'text-good-ink'
    : tone === 'critical' ? 'text-critical-ink'
    : tone === 'accent' ? 'text-accent'
    : 'text-ink'
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink2">{hint}</div>}
    </div>
  )
}

// ── misc ───────────────────────────────────────────────────────────────────
export function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span className="chip" title={title}>
      {children}
    </span>
  )
}

export function Empty({ icon = 'info', title, body }: { icon?: string; title: string; body?: string }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="text-muted">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <p className="font-medium text-ink">{title}</p>
      {body && <p className="max-w-reading text-sm text-ink2">{body}</p>}
    </div>
  )
}

export function PageTitle({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink2">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`
}
