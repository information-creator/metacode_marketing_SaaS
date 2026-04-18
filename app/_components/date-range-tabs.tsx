'use client'

import { useState } from 'react'
import type { DateRange } from './date-range'

const PRESETS = [
  { days: 7, label: '7일' },
  { days: 14, label: '14일' },
  { days: 30, label: '30일' },
  { days: 60, label: '60일' },
  { days: 90, label: '90일' },
  { days: 180, label: '180일' },
  { days: 365, label: '1년' },
]

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function DateRangeTabs({
  basePath,
  range,
  preserveParams = {},
}: {
  basePath: string
  range: DateRange
  preserveParams?: Record<string, string | undefined>
}) {
  const [showCustom, setShowCustom] = useState(range.mode === 'custom')
  const defaultFrom = range.mode === 'custom' ? range.from : toISO(new Date(Date.now() - 30 * 86400000))
  const defaultTo = range.mode === 'custom' ? range.to : toISO(new Date())
  const [fromVal, setFromVal] = useState(defaultFrom)
  const [toVal, setToVal] = useState(defaultTo)

  function hrefFor(days: number): string {
    const qs = new URLSearchParams()
    qs.set('days', String(days))
    for (const [k, v] of Object.entries(preserveParams)) {
      if (v && k !== 'days' && k !== 'from' && k !== 'to') qs.set(k, v)
    }
    return `${basePath}?${qs.toString()}`
  }

  function hrefCustom(): string {
    const qs = new URLSearchParams()
    qs.set('from', fromVal)
    qs.set('to', toVal)
    for (const [k, v] of Object.entries(preserveParams)) {
      if (v && k !== 'days' && k !== 'from' && k !== 'to') qs.set(k, v)
    }
    return `${basePath}?${qs.toString()}`
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {PRESETS.map((p) => {
          const active = range.mode === 'days' && range.days === p.days
          return (
            <a
              key={p.days}
              href={hrefFor(p.days)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--muted)',
                textDecoration: 'none',
              }}
            >
              {p.label}
            </a>
          )
        })}

        <button
          type="button"
          onClick={() => setShowCustom((s) => !s)}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            border: '1px solid var(--border)',
            background: range.mode === 'custom' ? 'var(--accent)' : 'transparent',
            color: range.mode === 'custom' ? '#fff' : 'var(--muted)',
            cursor: 'pointer',
          }}
        >
          사용자 지정 {showCustom ? '▲' : '▼'}
        </button>

        <span className="muted" style={{ fontSize: 14, marginLeft: 8 }}>
          {range.mode === 'custom'
            ? `${range.from} ~ ${range.to}`
            : `${toISO(new Date(Date.now() - range.days * 86400000))} ~ ${toISO(new Date())}`}
        </span>
      </div>

      {showCustom && (
        <div style={{ marginTop: 10, padding: 12, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>
            시작일{' '}
            <input
              type="date"
              value={fromVal}
              onChange={(e) => setFromVal(e.target.value)}
              max={toVal}
              style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 6, fontSize: 12 }}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>
            종료일{' '}
            <input
              type="date"
              value={toVal}
              onChange={(e) => setToVal(e.target.value)}
              min={fromVal}
              max={toISO(new Date())}
              style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 6, fontSize: 12 }}
            />
          </label>
          <a
            href={hrefCustom()}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--accent)',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            적용
          </a>
        </div>
      )}
    </div>
  )
}
