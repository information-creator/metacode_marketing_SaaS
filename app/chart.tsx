'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NormalizedDailyRow } from '@/lib/channels/sol/adapter'
import type { GoogleAdsDailyRow } from '@/lib/channels/google-ads/adapter'
import type { MetaAdsDailyRow } from '@/lib/channels/meta-ads/adapter'

type ChartPoint = { date: string; 메시지: number; 'Google Ads': number; 'Meta Ads': number }

export function OverviewChart({
  solRows,
  googleRows,
  metaRows,
}: {
  solRows: NormalizedDailyRow[]
  googleRows: GoogleAdsDailyRow[]
  metaRows: MetaAdsDailyRow[]
}) {
  const points: ChartPoint[] = useMemo(() => {
    const byDate = new Map<string, ChartPoint>()
    const get = (date: string) => {
      const existing = byDate.get(date) ?? { date, 메시지: 0, 'Google Ads': 0, 'Meta Ads': 0 }
      byDate.set(date, existing)
      return existing
    }
    for (const r of solRows) get(r.date).메시지 += r.cost_krw
    for (const r of googleRows) get(r.date)['Google Ads'] += r.cost_krw
    for (const r of metaRows) get(r.date)['Meta Ads'] += r.cost_krw
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [solRows, googleRows, metaRows])

  if (points.length === 0) return <div className="muted" style={{ fontSize: 13 }}>데이터 없음</div>

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232a33" />
          <XAxis dataKey="date" stroke="#8b949e" fontSize={11} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis stroke="#8b949e" fontSize={11} tickFormatter={(v: number) => `₩${Math.round(v / 1000)}k`} />
          <Tooltip
            contentStyle={{ background: '#14181d', border: '1px solid #232a33', borderRadius: 8, fontSize: 12 }}
            formatter={(v) => `₩${Number(v).toLocaleString('ko-KR')}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="메시지" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Google Ads" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Meta Ads" stroke="#1877f2" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function OverviewMixBar({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  if (data.length === 0) return <div className="muted" style={{ fontSize: 13 }}>데이터 없음</div>
  const total = data.reduce((a, d) => a + d.value, 0)

  return (
    <>
      <div style={{ display: 'flex', width: '100%', height: 40, borderRadius: 6, overflow: 'hidden', marginBottom: 16, background: 'var(--panel-2)' }}>
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0
          if (pct === 0) return null
          return (
            <div key={d.name} style={{ background: d.color, width: `${pct}%`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff' }}>
              {pct >= 10 ? `${pct.toFixed(0)}%` : ''}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0
          return (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{d.name}</span>
              <span className="muted">{pct.toFixed(1)}%</span>
              <span style={{ fontWeight: 600, minWidth: 90, textAlign: 'right' }}>₩{d.value.toLocaleString('ko-KR')}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}

export function SubTypeBarChart({ rows, colorMap }: { rows: NormalizedDailyRow[]; colorMap: Record<string, string> }) {
  const { data, keys } = useMemo(() => {
    const keySet = new Set<string>()
    const byDate = new Map<string, Record<string, number | string>>()
    for (const r of rows) {
      keySet.add(r.sub_type)
      const entry = byDate.get(r.date) ?? { date: r.date }
      entry[r.sub_type] = ((entry[r.sub_type] as number) ?? 0) + r.sent
      byDate.set(r.date, entry)
    }
    return {
      data: Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date))),
      keys: Array.from(keySet),
    }
  }, [rows])

  if (data.length === 0) return <div className="muted" style={{ fontSize: 13 }}>데이터 없음</div>

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232a33" />
          <XAxis dataKey="date" stroke="#8b949e" fontSize={11} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis stroke="#8b949e" fontSize={11} />
          <Tooltip contentStyle={{ background: '#14181d', border: '1px solid #232a33', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {keys.map((k) => (
            <Line key={k} type="monotone" dataKey={k} stroke={colorMap[k] ?? '#64748b'} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
