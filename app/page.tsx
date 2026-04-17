import { aggregateByChannel, fetchSolDailyRows, type NormalizedDailyRow } from '@/lib/channels/sol/adapter'
import { aggregateGoogleAds, fetchGoogleAdsDailyRows, type GoogleAdsDailyRow } from '@/lib/channels/google-ads/adapter'
import { aggregateMetaAds, fetchMetaAdsDailyRows, type MetaAdsDailyRow } from '@/lib/channels/meta-ads/adapter'
import {
  gradeColor,
  gradeFromRatio,
  gradeLabel,
  googleCtrBenchmark,
  metaCpmBenchmark,
  metaCtrBenchmark,
  smsSuccessBenchmark,
  type Benchmark,
} from '@/lib/benchmarks'
import { OverviewChart, OverviewMixBar } from './chart'
import { DateRangeTabs } from './_components/date-range-tabs'
import { parseDateRange, rangeFilter, rangeLabel, rangeToDays } from './_components/date-range'

export const dynamic = 'force-dynamic'

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

function delta(current: number, previous: number): { pct: number; dir: 'up' | 'down' | 'flat' } {
  if (previous === 0) return { pct: current > 0 ? 100 : 0, dir: current > 0 ? 'up' : 'flat' }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) return { pct: 0, dir: 'flat' }
  return { pct, dir: pct > 0 ? 'up' : 'down' }
}

function DeltaBadge({ current, previous, positiveGood = true }: { current: number; previous: number; positiveGood?: boolean }) {
  const d = delta(current, previous)
  const goodDirection = (d.dir === 'up' && positiveGood) || (d.dir === 'down' && !positiveGood)
  const color = d.dir === 'flat' ? 'var(--muted)' : goodDirection ? '#86efac' : '#fca5a5'
  const arrow = d.dir === 'up' ? '▲' : d.dir === 'down' ? '▼' : '—'
  return (
    <span style={{ color, fontSize: 12, fontWeight: 500 }}>
      {arrow} {Math.abs(d.pct).toFixed(1)}%
    </span>
  )
}

function BenchmarkBar({ bm }: { bm: Benchmark }) {
  const ratio = bm.value / bm.avg
  const grade = gradeFromRatio(ratio, bm.higherIsBetter)
  const color = gradeColor(grade)
  const filled = Math.min(Math.max(bm.higherIsBetter ? ratio : 1 / ratio, 0.2), 2.0) / 2.0
  return (
    <div className="card">
      <div className="kpi-label">{bm.label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div className="kpi-value" style={{ marginBottom: 0 }}>{bm.format(bm.value)}</div>
        <span style={{ color, fontSize: 12, fontWeight: 600 }}>{gradeLabel(grade)}</span>
      </div>
      <div style={{ marginTop: 10, background: 'var(--panel-2)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${filled * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <div className="kpi-sub" style={{ marginTop: 6 }}>
        업계 평균 {bm.format(bm.avg)} · {bm.note}
      </div>
    </div>
  )
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string; from?: string; to?: string }>
}) {
  const qs = (await searchParams) ?? {}
  const range = parseDateRange(qs, 30)
  const days = rangeToDays(range)

  const errors: Record<string, string> = {}
  let solNow: NormalizedDailyRow[] = []
  let solPrev: NormalizedDailyRow[] = []
  let googleNow: GoogleAdsDailyRow[] = []
  let googlePrev: GoogleAdsDailyRow[] = []
  let metaNow: MetaAdsDailyRow[] = []
  let metaPrev: MetaAdsDailyRow[] = []

  const splitByDate = <T extends { date: string }>(rows: T[], midDate: string) => ({
    now: rows.filter((r) => r.date >= midDate),
    prev: rows.filter((r) => r.date < midDate),
  })
  const midDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

  const [solRes, googleRes, metaRes] = await Promise.allSettled([
    fetchSolDailyRows(days * 2),
    fetchGoogleAdsDailyRows(days * 2),
    fetchMetaAdsDailyRows(days * 2),
  ])

  if (solRes.status === 'fulfilled') {
    const s = splitByDate(solRes.value, midDate)
    solNow = s.now
    solPrev = s.prev
  } else errors.sol = (solRes.reason as Error).message

  if (googleRes.status === 'fulfilled') {
    const s = splitByDate(googleRes.value, midDate)
    googleNow = s.now
    googlePrev = s.prev
  } else errors.google = (googleRes.reason as Error).message

  if (metaRes.status === 'fulfilled') {
    const s = splitByDate(metaRes.value, midDate)
    metaNow = s.now
    metaPrev = s.prev
  } else errors.meta = (metaRes.reason as Error).message

  const solAgg = aggregateByChannel(solNow)
  const solAggPrev = aggregateByChannel(solPrev)
  const gAgg = aggregateGoogleAds(googleNow)
  const gAggPrev = aggregateGoogleAds(googlePrev)
  const mAgg = aggregateMetaAds(metaNow)
  const mAggPrev = aggregateMetaAds(metaPrev)

  const messageCount = solAgg.sms.sent + solAgg.kakao_biz.sent + solAgg.other.sent
  const messageCountPrev = solAggPrev.sms.sent + solAggPrev.kakao_biz.sent + solAggPrev.other.sent
  const messageSuccess = solAgg.sms.successed + solAgg.kakao_biz.successed + solAgg.other.successed
  const messageCost = solAgg.sms.cost_krw + solAgg.kakao_biz.cost_krw + solAgg.other.cost_krw
  const messageCostPrev = solAggPrev.sms.cost_krw + solAggPrev.kakao_biz.cost_krw + solAggPrev.other.cost_krw
  const messageSuccessRate = messageCount > 0 ? (messageSuccess / messageCount) * 100 : 0

  const totalAdSpend = gAgg.total.cost_krw + mAgg.total.cost_krw
  const totalAdSpendPrev = gAggPrev.total.cost_krw + mAggPrev.total.cost_krw
  const totalClicks = gAgg.total.clicks + mAgg.total.clicks
  const totalClicksPrev = gAggPrev.total.clicks + mAggPrev.total.clicks
  const totalImpressions = gAgg.total.impressions + mAgg.total.impressions
  const totalImpressionsPrev = gAggPrev.total.impressions + mAggPrev.total.impressions

  const totalSpend = messageCost + totalAdSpend
  const totalSpendPrev = messageCostPrev + totalAdSpendPrev

  // Health summary
  const benchmarks: Benchmark[] = []
  if (googleNow.length > 0) benchmarks.push(googleCtrBenchmark(gAgg.ctr))
  if (metaNow.length > 0) {
    benchmarks.push(metaCtrBenchmark(mAgg.ctr))
    benchmarks.push(metaCpmBenchmark(mAgg.cpm))
  }
  if (solNow.length > 0) benchmarks.push(smsSuccessBenchmark(messageSuccessRate))

  const grades = benchmarks.map((b) => gradeFromRatio(b.value / b.avg, b.higherIsBetter))
  const score = grades.reduce((a, g) => a + ({ excellent: 5, good: 4, average: 3, below: 2, poor: 1 } as const)[g], 0) / Math.max(grades.length, 1)
  const healthLabel = score >= 4 ? '전반적으로 우수' : score >= 3 ? '평균 수준' : score >= 2 ? '일부 지표 미흡' : '개선 필요'
  const healthColor = score >= 4 ? '#22c55e' : score >= 3 ? '#fbbf24' : score >= 2 ? '#fb923c' : '#ef4444'

  const channelMix = [
    { name: '메시지', value: messageCost, color: '#22c55e' },
    { name: 'Google Ads', value: gAgg.total.cost_krw, color: '#3b82f6' },
    { name: 'Meta Ads', value: mAgg.total.cost_krw, color: '#1877f2' },
  ].filter((c) => c.value > 0)

  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">Overview</h1>
        <p className="page-subtitle">{rangeLabel(range)} · 동일 기간 전기간 대비 · 한국 업계 평균 기준</p>
      </header>

      <DateRangeTabs basePath="/" range={range} />

      {Object.entries(errors).map(([ch, err]) => (
        <div key={ch} className="error-banner">{ch} 수집 실패: {err}</div>
      ))}

      <section className="card" style={{ marginBottom: 20, borderLeft: `4px solid ${healthColor}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 30 }}>
            {score >= 4 ? '🟢' : score >= 3 ? '🟡' : '🟠'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
              지금 잘 하고 있나요 — <span style={{ color: healthColor }}>{healthLabel}</span>
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {benchmarks.length}개 핵심 지표 중 {grades.filter((g) => g === 'excellent' || g === 'good').length}개가 업계 평균 이상. 평균 등급 {score.toFixed(1)} / 5.0
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="kpi-label">총 지출 (30일)</div>
          <div className="kpi-value">₩{fmt(totalSpend)}</div>
          <div className="kpi-sub">
            전기간 ₩{fmt(totalSpendPrev)} · <DeltaBadge current={totalSpend} previous={totalSpendPrev} positiveGood={false} />
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">메시지 발송</div>
          <div className="kpi-value">{fmt(messageCount)}건</div>
          <div className="kpi-sub">
            성공률 {messageSuccessRate.toFixed(1)}% · <DeltaBadge current={messageCount} previous={messageCountPrev} />
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">광고 클릭</div>
          <div className="kpi-value">{fmt(totalClicks)}</div>
          <div className="kpi-sub">
            노출 {fmt(totalImpressions)} · <DeltaBadge current={totalClicks} previous={totalClicksPrev} />
          </div>
        </div>
        <div className="card">
          <div className="kpi-label">광고비</div>
          <div className="kpi-value">₩{fmt(totalAdSpend)}</div>
          <div className="kpi-sub">
            G ₩{fmt(gAgg.total.cost_krw)} · M ₩{fmt(mAgg.total.cost_krw)} · <DeltaBadge current={totalAdSpend} previous={totalAdSpendPrev} positiveGood={false} />
          </div>
        </div>
      </section>

      {benchmarks.length > 0 && (
        <>
          <h3 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            업계 평균 대비 — {benchmarks.length}개 지표
          </h3>
          <section className={`grid grid-${Math.min(benchmarks.length, 4)}`} style={{ marginBottom: 20 }}>
            {benchmarks.map((b) => (
              <BenchmarkBar key={b.label} bm={b} />
            ))}
          </section>
        </>
      )}

      <section className="grid grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            채널별 비용 분포
          </h2>
          <OverviewMixBar data={channelMix} />
        </div>
        <div className="card">
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            채널 요약
          </h2>
          <table className="data">
            <thead>
              <tr><th>채널</th><th style={{ textAlign: 'right' }}>볼륨</th><th style={{ textAlign: 'right' }}>비용</th></tr>
            </thead>
            <tbody>
              <tr><td>메시지 (SOL)</td><td style={{ textAlign: 'right' }}>{fmt(messageCount)}건</td><td style={{ textAlign: 'right' }}>₩{fmt(messageCost)}</td></tr>
              <tr><td>Google Ads</td><td style={{ textAlign: 'right' }}>{fmt(gAgg.total.clicks)} 클릭</td><td style={{ textAlign: 'right' }}>₩{fmt(gAgg.total.cost_krw)}</td></tr>
              <tr><td>Meta Ads</td><td style={{ textAlign: 'right' }}>{fmt(mAgg.total.clicks)} 클릭</td><td style={{ textAlign: 'right' }}>₩{fmt(mAgg.total.cost_krw)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          일별 채널 비용 추이
        </h2>
        <OverviewChart
          solRows={solNow}
          googleRows={googleNow}
          metaRows={metaNow}
        />
      </section>
    </main>
  )
}
