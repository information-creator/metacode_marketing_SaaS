'use client'

import { useState } from 'react'
import {
  gradeColor,
  gradeFromRatio,
  gradeLabel,
  googleCtrBenchmark,
  type BenchmarkGrade,
} from '@/lib/benchmarks'

type CampaignBm = {
  id: string
  name: string
  ctr: number
  cost_krw: number
  impressions: number
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

function adviceFor(g: BenchmarkGrade): string {
  return (
    g === 'excellent' ? '광고 카피/타겟팅이 매우 잘 맞고 있어요. 이 수준의 CTR을 유지하면서 예산 확대를 고려해볼 만합니다.' :
    g === 'good' ? '업계 평균 이상. 현재 방향 유지하면서 A/B 테스트로 추가 개선 여지 탐색.' :
    g === 'average' ? '평균 수준. 광고 카피 리프레시나 키워드/오디언스 재조정으로 상승 여지 있음.' :
    g === 'below' ? '업계 평균에 못 미침. 광고 소재/제안·타겟 적합성·랜딩 페이지 체크 권장.' :
    '즉각 점검 필요. 광고 소재 교체, 타겟 재설정, 랜딩 페이지 관련성 재검토.'
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

export function GoogleBenchmarkPanel({
  overall,
  campaigns,
}: {
  overall: { ctr: number }
  campaigns: CampaignBm[]
}) {
  const [scope, setScope] = useState<string>('all')

  const current = scope === 'all'
    ? { name: '전체', ctr: overall.ctr, impressions: 1 }
    : (campaigns.find((c) => c.id === scope) ?? { name: '-', ctr: 0, impressions: 0 })

  const ctrBm = googleCtrBenchmark(current.ctr)
  const ctrRatio = ctrBm.avg > 0 ? ctrBm.value / ctrBm.avg : 0
  const ctrGrade: BenchmarkGrade = current.impressions > 0 ? gradeFromRatio(ctrRatio, true) : 'average'
  const ctrColor = gradeColor(ctrGrade)
  const ctrDiffPct = ((ctrRatio - 1) * 100).toFixed(0)

  // 비용이 있는 캠페인만 선택지로 (노출 없는 유령 캠페인 제외)
  const scopeOptions: { id: string; label: string }[] = [
    { id: 'all', label: '전체' },
    ...[...campaigns]
      .filter((c) => c.impressions > 0)
      .sort((a, b) => b.cost_krw - a.cost_krw)
      .map((c) => ({ id: c.id, label: c.name })),
  ]

  return (
    <section className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${ctrColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div className="kpi-label" style={{ marginBottom: 2 }}>업계 평균 대비 평가</div>
          <div className="muted" style={{ fontSize: 11 }}>
            한국 검색 광고 CTR 평균({ctrBm.avg}%) 기준 · 현재 선택: <b style={{ color: 'var(--text)' }}>{current.name}</b>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>등급</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', background: ctrColor, padding: '4px 12px', borderRadius: 999 }}>
            {gradeLabel(ctrGrade)}
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
          value={current.impressions > 0 ? `${current.ctr.toFixed(2)}%` : '-'}
          avgLabel={`업계 평균 ${ctrBm.avg}%`}
          diff={ctrDiffPct}
          grade={ctrGrade}
          color={ctrColor}
          higherBetter={true}
        />
      </div>

      <p style={{ fontSize: 13, margin: 0, padding: '10px 12px', background: 'var(--panel-2)', borderRadius: 8, borderLeft: `3px solid ${ctrColor}` }}>
        <b style={{ color: ctrColor, marginRight: 6 }}>진단</b>{adviceFor(ctrGrade)}
      </p>
    </section>
  )
}
