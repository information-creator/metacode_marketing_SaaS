export type DateRange = { mode: 'days'; days: number } | { mode: 'custom'; from: string; to: string }

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function parseDays(v: string | undefined, fallback = 30): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1 || n > 365) return fallback
  return Math.round(n)
}

export function parseDateRange(
  searchParams: { days?: string; from?: string; to?: string },
  fallbackDays = 30,
): DateRange {
  const { days, from, to } = searchParams
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { mode: 'custom', from, to }
  }
  return { mode: 'days', days: parseDays(days, fallbackDays) }
}

export function rangeToDays(r: DateRange): number {
  if (r.mode === 'days') return r.days
  const start = new Date(r.from + 'T00:00:00Z').getTime()
  return Math.max(1, Math.ceil((Date.now() - start) / 86400000))
}

export function rangeFilter<T extends { date: string }>(rows: T[], r: DateRange): T[] {
  if (r.mode === 'days') {
    const cutoff = toISO(new Date(Date.now() - r.days * 86400000))
    return rows.filter((x) => x.date >= cutoff)
  }
  return rows.filter((x) => x.date >= r.from && x.date <= r.to)
}

export function rangeLabel(r: DateRange): string {
  return r.mode === 'days' ? `최근 ${r.days}일` : `${r.from} ~ ${r.to}`
}
