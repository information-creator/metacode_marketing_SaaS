'use client'

import { useState } from 'react'
import {
  gradeColor,
  gradeFromRatio,
  gradeLabel,
  metaCpmBenchmark,
  metaCtrBenchmark,
  type BenchmarkGrade,
} from '@/lib/benchmarks'

type CampaignBm = {
  id: string
  name: string
  ctr: number
  cpm: number
  cost_krw: number
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

const GRADE_ORDER: Record<string, number> = { excellent: 4, good: 3, average: 2, below: 1, poor: 0 }
function worseGrade(a: BenchmarkGrade, b: BenchmarkGrade): BenchmarkGrade {
  return GRADE_ORDER[a] <= GRADE_ORDER[b] ? a : b
}

function adviceFor(g: BenchmarkGrade): string {
  return (
    g === 'excellent' ? 'CTR·CPM 모두 업계 평균을 크게 상회. 이 크리에이티브/타겟팅을 유지하면서 예산 확대 검토.' :
    g === 'good' ? '전반적으로 양호. 고성과 캠페인으로 예산 쏠림 확인 후 점진 확장.' :
    g === 'poor' ? 'CTR 또는 CPM이 심각하게 미달. 크리에이티브 전면 교체 또는 타겟 재설정 시급.' :
    g === 'below' ? '일부 지표 미흡. 크리에이티브 리프레시, 타겟 오디언스 재검토 권장.' :
    '평균 수준. 안정 운영 중이지만 A/B 테스트로 개선 여지 있음.'
  )
}

function MetricTile({
  label, value, avgLabel, diff, grade, color, higherBetter,
}: {
  label: string; value: string; avgLabel: string; diff: string
  grade: BenchmarkGrade; color: string; higherBetter: boolean
}) {
  const sign = Number(diff) >= 0 ? '+' : ''
  const better = (higherBetter && Number(diff) >= 0) || (!higherBetter && Number(diff) <= 0)
  return (
    <div style={{ flex: '1 1 220px', minWidth: 220, padding: 14, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.03em' }}>{label}</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: color, padding: '2px 8px', borderRadius: 999 }}>
          {gradeLabel(grade)}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{avgLabel}</div>
      <div style={{ fontSize: 12 }}>
        <span style={{ color, fontWeight: 600 }}>{sign}{diff}%</span>
        <span className="muted" style={{ marginLeft: 6 }}>
          {higherBetter ? '(높을수록 좋음)' : '(낮을수록 좋음)'}
        </span>
        <span style={{ marginLeft: 8, fontSize: 11, color: better ? '#86efac' : '#fca5a5' }}>
          {better ? '▲ 평균 이상' : '▼ 평균 이하'}
        </span>
      </div>
    </div>
  )
}

export function BenchmarkPanel({
  overall,
  campaigns,
}: {
  overall: { ctr: number; cpm: number }
  campaigns: CampaignBm[]
}) {
  const [scope, setScope] = useState<string>('all')

  const current = scope === 'all'
    ? { name: '전체', ctr: overall.ctr, cpm: overall.cpm }
    : (campaigns.find((c) => c.id === scope) ?? { name: '-', ctr: 0, cpm: 0 })

  const ctrBm = metaCtrBenchmark(current.ctr)
  const ctrRatio = ctrBm.avg > 0 ? ctrBm.value / ctrBm.avg : 0
  const ctrGrade = gradeFromRatio(ctrRatio, true)
  const ctrColor = gradeColor(ctrGrade)
  const ctrDiffPct = ((ctrRatio - 1) * 100).toFixed(0)

  const cpmBm = metaCpmBenchmark(current.cpm)
  const cpmRatio = cpmBm.avg > 0 ? cpmBm.value / cpmBm.avg : 0
  const cpmGrade = current.cpm > 0 ? gradeFromRatio(cpmRatio, false) : 'average'
  const cpmColor = gradeColor(cpmGrade)
  const cpmDiffPct = ((cpmRatio - 1) * 100).toFixed(0)

  const overallGrade = worseGrade(ctrGrade, cpmGrade)
  const overallColor = gradeColor(overallGrade)

  // 스코프 선택 pill: 전체 + cost 큰 순 캠페인
  const scopeOptions: { id: string; label: string }[] = [
    { id: 'all', label: '전체' },
    ...[...campaigns]
      .sort((a, b) => b.cost_krw - a.cost_krw)
      .map((c) => ({ id: c.id, label: c.name })),
  ]

  return (
    <section className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${overallColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div className="kpi-label" style={{ marginBottom: 2 }}>업계 평균 대비 평가</div>
          <div className="muted" style={{ fontSize: 11 }}>
            한국 Facebook/Instagram Feed 기준 · CTR·CPM 2개 지표 종합 · 현재 선택: <b style={{ color: 'var(--text)' }}>{current.name}</b>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>종합 등급</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', background: overallColor, padding: '4px 12px', borderRadius: 999 }}>
            {gradeLabel(overallGrade)}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {scopeOptions.map((opt) => {
          const active = scope === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScope(opt.id)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: active ? 'var(--accent)' : 'transparent',
                color: active ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                maxWidth: 280,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={opt.label}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <MetricTile
          label="CTR (클릭률)"
          value={`${current.ctr.toFixed(2)}%`}
          avgLabel={`업계 평균 ${ctrBm.avg}%`}
          diff={ctrDiffPct}
          grade={ctrGrade}
          color={ctrColor}
          higherBetter={true}
        />
        <MetricTile
          label="CPM (1,000회 노출당 비용)"
          value={`₩${fmt(Math.round(current.cpm))}`}
          avgLabel={`업계 평균 ₩${fmt(cpmBm.avg)}`}
          diff={cpmDiffPct}
          grade={cpmGrade}
          color={cpmColor}
          higherBetter={false}
        />
      </div>

      <p style={{ fontSize: 13, margin: 0, padding: '10px 12px', background: 'var(--panel-2)', borderRadius: 8, borderLeft: `3px solid ${overallColor}` }}>
        <b style={{ color: overallColor, marginRight: 6 }}>진단</b>{adviceFor(overallGrade)}
      </p>
    </section>
  )
}
