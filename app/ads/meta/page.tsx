import {
  aggregateMetaAds,
  type MetaAdsDailyRow,
} from '@/lib/channels/meta-ads/adapter'
import { queryMetaDailyRows } from '@/lib/queries'
import { MetaCostBar, MetaDailyChart } from './chart'
import { BenchmarkPanel } from './benchmark-panel'
import { DateRangeTabs } from '@/app/_components/date-range-tabs'
import { parseDateRange, rangeFilter, rangeLabel, rangeToDays } from '@/app/_components/date-range'
import { gradeColor, gradeFromRatio, gradeLabel, metaCpmBenchmark, metaCtrBenchmark } from '@/lib/benchmarks'

export const dynamic = 'force-dynamic'

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

type CampaignSummary = {
  id: string
  name: string
  impressions: number
  reach: number
  clicks: number
  cost_krw: number
  conversions: number
  ctr: number
  cpc: number
  cpm: number
}

function byCampaign(rows: MetaAdsDailyRow[]): CampaignSummary[] {
  const m = new Map<string, CampaignSummary>()
  for (const r of rows) {
    const e = m.get(r.campaign_id) ?? {
      id: r.campaign_id,
      name: r.campaign_name,
      impressions: 0,
      reach: 0,
      clicks: 0,
      cost_krw: 0,
      conversions: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
    }
    e.impressions += r.impressions
    e.reach = Math.max(e.reach, r.reach)
    e.clicks += r.clicks
    e.cost_krw += r.cost_krw
    e.conversions += r.conversions
    m.set(r.campaign_id, e)
  }
  const list = Array.from(m.values())
  for (const c of list) {
    c.ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0
    c.cpc = c.clicks > 0 ? c.cost_krw / c.clicks : 0
    c.cpm = c.impressions > 0 ? (c.cost_krw / c.impressions) * 1000 : 0
  }
  list.sort((a, b) => b.cost_krw - a.cost_krw)
  return list
}

const GRADE_ORDER: Record<string, number> = { excellent: 4, good: 3, average: 2, below: 1, poor: 0 }
function worseGrade(a: string, b: string): string {
  return GRADE_ORDER[a] <= GRADE_ORDER[b] ? a : b
}

export default async function MetaAdsPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string; from?: string; to?: string }>
}) {
  const params = (await searchParams) ?? {}
  const range = parseDateRange(params, 30)

  let rows: MetaAdsDailyRow[] = []
  let error: string | null = null
  try {
    rows = await queryMetaDailyRows(range)
  } catch (e) {
    error = (e as Error).message
  }

  const agg = aggregateMetaAds(rows)
  const campaigns = byCampaign(rows)

  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">Meta Ads</h1>
        <p className="page-subtitle">{rangeLabel(range)} · Graph API v21.0 · Facebook + Instagram 통합</p>
      </header>

      <DateRangeTabs basePath="/ads/meta" range={range} />

      {error && <div className="error-banner">수집 실패: {error}</div>}

      {!error && rows.length === 0 && (
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>이 기간에 광고 활동이 없습니다.</p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <BenchmarkPanel
            overall={{ ctr: agg.ctr, cpm: agg.cpm }}
            campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, ctr: c.ctr, cpm: c.cpm, cost_krw: c.cost_krw }))}
          />

          <section className="grid grid-4" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="kpi-label">노출</div>
              <div className="kpi-value">{fmt(agg.total.impressions)}</div>
              <div className="kpi-sub">CTR {agg.ctr.toFixed(2)}%</div>
            </div>
            <div className="card">
              <div className="kpi-label">도달</div>
              <div className="kpi-value">{fmt(agg.total.reach)}</div>
              <div className="kpi-sub">CPM ₩{fmt(Math.round(agg.cpm))}</div>
            </div>
            <div className="card">
              <div className="kpi-label">클릭</div>
              <div className="kpi-value">{fmt(agg.total.clicks)}</div>
              <div className="kpi-sub">CPC ₩{fmt(Math.round(agg.cpc))}</div>
            </div>
            <div className="card">
              <div className="kpi-label">비용</div>
              <div className="kpi-value">₩{fmt(agg.total.cost_krw)}</div>
              <div className="kpi-sub">{rangeLabel(range)} 누적</div>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              일별 추이 (노출 · 도달 · 비용)
            </h2>
            <MetaDailyChart rows={rows} />
          </section>

          {campaigns.length > 1 && (
            <section className="card" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                캠페인별 비용 (Top 10)
              </h2>
              <MetaCostBar rows={rows} />
            </section>
          )}

          <section className="card">
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              캠페인 상세
            </h2>
            <table className="data">
              <thead>
                <tr>
                  <th>캠페인</th>
                  <th style={{ textAlign: 'right' }}>노출</th>
                  <th style={{ textAlign: 'right' }}>도달</th>
                  <th style={{ textAlign: 'right' }}>클릭</th>
                  <th style={{ textAlign: 'right' }}>CTR</th>
                  <th style={{ textAlign: 'right' }}>CPC</th>
                  <th style={{ textAlign: 'right' }}>CPM</th>
                  <th style={{ textAlign: 'right' }}>비용</th>
                  <th style={{ textAlign: 'right' }}>액션</th>
                  <th style={{ textAlign: 'center' }}>평가</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const ctrG = gradeFromRatio(c.ctr / metaCtrBenchmark(c.ctr).avg, true)
                  const cpmG = c.cpm > 0 ? gradeFromRatio(c.cpm / metaCpmBenchmark(c.cpm).avg, false) : 'average'
                  const grade = worseGrade(ctrG, cpmG) as 'excellent' | 'good' | 'average' | 'below' | 'poor'
                  const color = gradeColor(grade)
                  const tooltip = `CTR ${c.ctr.toFixed(2)}% (${gradeLabel(ctrG)}) · CPM ₩${fmt(Math.round(c.cpm))} (${gradeLabel(cpmG)})`
                  return (
                    <tr key={c.id}>
                      <td><b>{c.name}</b><div className="muted" style={{ fontSize: 11 }}>{c.id}</div></td>
                      <td style={{ textAlign: 'right' }}>{fmt(c.impressions)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(c.reach)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(c.clicks)}</td>
                      <td style={{ textAlign: 'right' }}>{c.ctr.toFixed(2)}%</td>
                      <td style={{ textAlign: 'right' }}>₩{fmt(Math.round(c.cpc))}</td>
                      <td style={{ textAlign: 'right' }}>₩{fmt(Math.round(c.cpm))}</td>
                      <td style={{ textAlign: 'right' }}>₩{fmt(c.cost_krw)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(c.conversions)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span title={tooltip} style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: color, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                          {gradeLabel(grade)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 11, margin: '12px 0 0' }}>
              * "평가"는 각 캠페인의 CTR · CPM을 업계 평균(CTR 1.2%, CPM ₩7,000)과 비교해 더 낮은 등급을 종합 표시. 마우스오버 시 세부 등급 표시.
              <br />* "액션"은 Meta의 <code>actions</code> 필드 전체 합계 (페이지 참여, 링크 클릭, 픽셀 이벤트 등 포함).
            </p>
          </section>
        </>
      )}
    </main>
  )
}
