'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MetaAdsDailyRow } from '@/lib/channels/meta-ads/adapter'

export function MetaDailyChart({ rows }: { rows: MetaAdsDailyRow[] }) {
  const data = useMemo(() => {
    const byDate = new Map<string, { date: string; impressions: number; reach: number; cost: number }>()
    for (const r of rows) {
      const e = byDate.get(r.date) ?? { date: r.date, impressions: 0, reach: 0, cost: 0 }
      e.impressions += r.impressions
      e.reach += r.reach
      e.cost += r.cost_krw
      byDate.set(r.date, e)
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [rows])

  if (data.length === 0) return <div className="muted" style={{ fontSize: 13 }}>데이터 없음</div>

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232a33" />
          <XAxis dataKey="date" stroke="#8b949e" fontSize={11} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis yAxisId="left" stroke="#8b949e" fontSize={11} />
          <YAxis yAxisId="right" orientation="right" stroke="#8b949e" fontSize={11} />
          <Tooltip contentStyle={{ background: '#14181d', border: '1px solid #232a33', borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="left" type="monotone" dataKey="impressions" name="노출" stroke="#60a5fa" strokeWidth={2} dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="reach" name="도달" stroke="#a78bfa" strokeWidth={2} dot={false} />
          <Line yAxisId="right" type="monotone" dataKey="cost" name="비용(₩)" stroke="#f87171" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MetaCostBar({ rows }: { rows: MetaAdsDailyRow[] }) {
  const data = useMemo(() => {
    const m = new Map<string, { name: string; cost: number }>()
    for (const r of rows) {
      const e = m.get(r.campaign_id) ?? { name: r.campaign_name, cost: 0 }
      e.cost += r.cost_krw
      m.set(r.campaign_id, e)
    }
    return Array.from(m.values()).sort((a, b) => b.cost - a.cost).slice(0, 10)
  }, [rows])

  if (data.length === 0) return null

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232a33" />
          <XAxis dataKey="name" stroke="#8b949e" fontSize={11} interval={0} angle={-20} textAnchor="end" height={80} />
          <YAxis stroke="#8b949e" fontSize={11} />
          <Tooltip contentStyle={{ background: '#14181d', border: '1px solid #232a33', borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="cost" name="비용(₩)" fill="#1877f2" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
