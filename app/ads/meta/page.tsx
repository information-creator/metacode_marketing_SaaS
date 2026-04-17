import {
  aggregateMetaAds,
  fetchMetaAdsDailyRows,
  type MetaAdsDailyRow,
} from '@/lib/channels/meta-ads/adapter'
import { MetaCostBar, MetaDailyChart } from './chart'
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
  }
  list.sort((a, b) => b.cost_krw - a.cost_krw)
  return list
}

export default async function MetaAdsPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string; from?: string; to?: string }>
}) {
  const params = (await searchParams) ?? {}
  const range = parseDateRange(params, 30)
  const fetchDays = rangeToDays(range)

  let rows: MetaAdsDailyRow[] = []
  let error: string | null = null
  try {
    const all = await fetchMetaAdsDailyRows(fetchDays)
    rows = rangeFilter(all, range)
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

          {(() => {
            const ctrBm = metaCtrBenchmark(agg.ctr)
            const ctrRatio = ctrBm.value / ctrBm.avg
            const ctrGrade = gradeFromRatio(ctrRatio, true)
            const ctrColor = gradeColor(ctrGrade)
            const cpmBm = metaCpmBenchmark(agg.cpm)
            const cpmRatio = cpmBm.value / cpmBm.avg
            const cpmGrade = gradeFromRatio(cpmRatio, false)
            const cpmColor = gradeColor(cpmGrade)
            const worst = ctrGrade === 'poor' || cpmGrade === 'poor' ? 'poor'
              : ctrGrade === 'below' || cpmGrade === 'below' ? 'below'
              : ctrGrade === 'excellent' && cpmGrade === 'excellent' ? 'excellent'
              : 'average'
            const barColor = gradeColor(worst)
            const advice =
              worst === 'excellent' ? 'CTR·CPM 모두 업계 평균을 크게 상회. 이 크리에이티브/타겟팅을 유지하면서 예산 확대 검토.' :
              worst === 'poor' ? 'CTR 또는 CPM이 심각하게 미달. 크리에이티브 전면 교체 또는 타겟 재설정 시급.' :
              worst === 'below' ? '일부 지표 미흡. 크리에이티브 리프레시, 타겟 오디언스 재검토 권장.' :
              '평균~양호 수준. 안정 운영 중이지만 A/B 테스트로 개선 여지 있음.'
            return (
              <section className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${barColor}` }}>
                <div className="kpi-label" style={{ marginBottom: 10 }}>업계 평균 대비 평가</div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>CTR {agg.ctr.toFixed(2)}%</div>
                    <div><span style={{ color: ctrColor, fontSize: 13, fontWeight: 600 }}>{gradeLabel(ctrGrade)}</span>
                      <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                        평균 {ctrBm.avg}% 대비 <b style={{ color: ctrColor }}>{ctrRatio >= 1 ? '+' : ''}{((ctrRatio - 1) * 100).toFixed(0)}%</b>
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>CPM ₩{fmt(Math.round(agg.cpm))}</div>
                    <div><span style={{ color: cpmColor, fontSize: 13, fontWeight: 600 }}>{gradeLabel(cpmGrade)}</span>
                      <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                        평균 ₩{fmt(cpmBm.avg)} 대비 <b style={{ color: cpmColor }}>{cpmRatio >= 1 ? '+' : ''}{((cpmRatio - 1) * 100).toFixed(0)}% (낮을수록 좋음)</b>
                      </span>
                    </div>
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>{advice}</p>
              </section>
            )
          })()}

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
                  <th style={{ textAlign: 'right' }}>비용</th>
                  <th style={{ textAlign: 'right' }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td><b>{c.name}</b><div className="muted" style={{ fontSize: 11 }}>{c.id}</div></td>
                    <td style={{ textAlign: 'right' }}>{fmt(c.impressions)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(c.reach)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(c.clicks)}</td>
                    <td style={{ textAlign: 'right' }}>{c.ctr.toFixed(2)}%</td>
                    <td style={{ textAlign: 'right' }}>₩{fmt(Math.round(c.cpc))}</td>
                    <td style={{ textAlign: 'right' }}>₩{fmt(c.cost_krw)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(c.conversions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted" style={{ fontSize: 11, margin: '12px 0 0' }}>
              * "액션"은 Meta의 <code>actions</code> 필드 전체 합계 (페이지 참여, 링크 클릭, 픽셀 이벤트 등 포함). 전환만 분리하려면 <code>action_type</code>별 필터 설정 필요.
            </p>
          </section>
        </>
      )}
    </main>
  )
}
