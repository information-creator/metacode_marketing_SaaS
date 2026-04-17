import {
  aggregateGoogleAds,
  fetchAllGoogleAdsCampaigns,
  fetchGoogleAdsDailyRows,
  type GoogleAdsCampaign,
  type GoogleAdsDailyRow,
} from '@/lib/channels/google-ads/adapter'
import { AdsCostBar, AdsDailyChart } from './chart'
import { DateRangeTabs } from '@/app/_components/date-range-tabs'
import { parseDateRange, rangeFilter, rangeLabel, rangeToDays } from '@/app/_components/date-range'
import { gradeColor, gradeFromRatio, gradeLabel, googleCtrBenchmark } from '@/lib/benchmarks'

export const dynamic = 'force-dynamic'

type SearchParams = { status?: string; days?: string; from?: string; to?: string }

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

function statusPill(status: string) {
  const cls =
    status === 'ENABLED' ? 'pill ok' : status === 'PAUSED' ? 'pill warn' : status === 'REMOVED' ? 'pill bad' : 'pill'
  return <span className={cls}>{status}</span>
}

type CampaignSummary = {
  id: string
  name: string
  status: string
  channel_type: string
  start_date: string
  end_date: string
  impressions: number
  clicks: number
  cost_krw: number
  conversions: number
  ctr: number
  cpc: number
}

function mergeCampaignsWithMetrics(
  campaigns: GoogleAdsCampaign[],
  rows: GoogleAdsDailyRow[],
): CampaignSummary[] {
  const metricsById = new Map<string, { impressions: number; clicks: number; cost_krw: number; conversions: number }>()
  for (const r of rows) {
    const e = metricsById.get(r.campaign_id) ?? { impressions: 0, clicks: 0, cost_krw: 0, conversions: 0 }
    e.impressions += r.impressions
    e.clicks += r.clicks
    e.cost_krw += r.cost_krw
    e.conversions += r.conversions
    metricsById.set(r.campaign_id, e)
  }

  return campaigns.map((c) => {
    const m = metricsById.get(c.id) ?? { impressions: 0, clicks: 0, cost_krw: 0, conversions: 0 }
    const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0
    const cpc = m.clicks > 0 ? m.cost_krw / m.clicks : 0
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      channel_type: c.channel_type,
      start_date: c.start_date,
      end_date: c.end_date,
      ...m,
      ctr,
      cpc,
    }
  })
}

function StatusTabs({ current, counts }: { current: string; counts: Record<string, number> }) {
  const tabs = [
    { key: 'ALL', label: '전체', count: counts.ALL },
    { key: 'ENABLED', label: '활성', count: counts.ENABLED },
    { key: 'PAUSED', label: '일시중지', count: counts.PAUSED },
    { key: 'REMOVED', label: '삭제됨', count: counts.REMOVED },
  ]
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      {tabs.map((t) => {
        const active = current === t.key
        const href = t.key === 'ALL' ? '/ads/google' : `/ads/google?status=${t.key}`
        return (
          <a
            key={t.key}
            href={href}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              border: '1px solid var(--border)',
              background: active ? 'var(--panel-2)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--muted)',
            }}
          >
            {t.label} <span style={{ opacity: 0.6 }}>({t.count ?? 0})</span>
          </a>
        )
      })}
    </div>
  )
}

export default async function GoogleAdsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {}
  const filterStatus = (params.status ?? 'ENABLED').toUpperCase()
  const range = parseDateRange(params, 30)
  const fetchDays = rangeToDays(range)

  let rows: GoogleAdsDailyRow[] = []
  let campaigns: GoogleAdsCampaign[] = []
  let error: string | null = null
  try {
    ;[rows, campaigns] = await Promise.all([fetchGoogleAdsDailyRows(fetchDays), fetchAllGoogleAdsCampaigns()])
    rows = rangeFilter(rows, range)
  } catch (e) {
    error = (e as Error).message
  }

  const agg = aggregateGoogleAds(rows)
  const allSummaries = mergeCampaignsWithMetrics(campaigns, rows)

  const counts = {
    ALL: allSummaries.length,
    ENABLED: allSummaries.filter((c) => c.status === 'ENABLED').length,
    PAUSED: allSummaries.filter((c) => c.status === 'PAUSED').length,
    REMOVED: allSummaries.filter((c) => c.status === 'REMOVED').length,
  }

  const visibleSummaries =
    filterStatus === 'ALL' ? allSummaries : allSummaries.filter((c) => c.status === filterStatus)
  visibleSummaries.sort((a, b) => {
    if (b.cost_krw !== a.cost_krw) return b.cost_krw - a.cost_krw
    return a.name.localeCompare(b.name)
  })

  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">Google Ads</h1>
        <p className="page-subtitle">
          전체 {counts.ALL}개 캠페인 · 활성 {counts.ENABLED}개 · {rangeLabel(range)} 실적 기준 · API v20
        </p>
      </header>

      <DateRangeTabs
        basePath="/ads/google"
        range={range}
        preserveParams={{ status: filterStatus !== 'ENABLED' ? filterStatus : undefined }}
      />

      {error && <div className="error-banner">수집 실패: {error}</div>}

      {rows.length > 0 && (
        <section className="grid grid-4" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="kpi-label">노출</div>
            <div className="kpi-value">{fmt(agg.total.impressions)}</div>
            <div className="kpi-sub">CTR {agg.ctr.toFixed(2)}%</div>
          </div>
          <div className="card">
            <div className="kpi-label">클릭</div>
            <div className="kpi-value">{fmt(agg.total.clicks)}</div>
            <div className="kpi-sub">CPC ₩{fmt(Math.round(agg.cpc))}</div>
          </div>
          <div className="card">
            <div className="kpi-label">비용</div>
            <div className="kpi-value">₩{fmt(agg.total.cost_krw)}</div>
            <div className="kpi-sub">활성 캠페인 기준</div>
          </div>
          <div className="card">
            <div className="kpi-label">전환</div>
            <div className="kpi-value">{agg.total.conversions.toFixed(2)}</div>
            <div className="kpi-sub">
              CPA {agg.total.conversions > 0 ? `₩${fmt(Math.round(agg.cpa))}` : '-'} · ROAS {agg.total.conversions > 0 ? `${agg.roas.toFixed(2)}x` : '-'}
            </div>
          </div>
        </section>
      )}

      {rows.length > 0 && (() => {
        const bm = googleCtrBenchmark(agg.ctr)
        const ratio = bm.value / bm.avg
        const grade = gradeFromRatio(ratio, bm.higherIsBetter)
        const color = gradeColor(grade)
        const diff = ((ratio - 1) * 100).toFixed(0)
        const diffSign = ratio >= 1 ? '+' : ''
        const advice =
          grade === 'excellent' ? '광고 카피/타겟팅이 매우 잘 맞고 있어요. 이 수준의 CTR을 유지하면서 예산 확대를 고려해볼 만합니다.' :
          grade === 'good' ? '업계 평균 이상이에요. 현재 방향 유지하면서 A/B 테스트로 추가 개선 여지 탐색.' :
          grade === 'average' ? '평균 수준. 광고 카피 리프레시나 키워드/오디언스 재조정으로 상승 여지 있음.' :
          grade === 'below' ? '업계 평균에 못 미침. 광고 소재/제안·타겟 적합성·랜딩 페이지 체크 권장.' :
          '즉각 점검 필요. 광고 소재 교체, 타겟 재설정, 랜딩 페이지 관련성 재검토.'
        return (
          <section className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${color}` }}>
            <div className="kpi-label" style={{ marginBottom: 6 }}>업계 평균 대비 평가</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>CTR {agg.ctr.toFixed(2)}%</div>
              <span style={{ color, fontSize: 13, fontWeight: 600 }}>{gradeLabel(grade)}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                업계 평균({bm.avg}%) 대비 <b style={{ color }}>{diffSign}{diff}%</b>
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>{advice}</p>
          </section>
        )
      })()}

      {rows.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            일별 추이 (활성 캠페인)
          </h2>
          <AdsDailyChart rows={rows} />
        </section>
      )}

      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            캠페인 목록
          </h2>
          <span className="muted" style={{ fontSize: 12 }}>{visibleSummaries.length}개 표시</span>
        </div>

        <StatusTabs current={filterStatus} counts={counts} />

        {visibleSummaries.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>해당 상태의 캠페인이 없습니다.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>캠페인</th>
                  <th>상태</th>
                  <th>유형</th>
                  <th style={{ textAlign: 'right' }}>노출</th>
                  <th style={{ textAlign: 'right' }}>클릭</th>
                  <th style={{ textAlign: 'right' }}>CTR</th>
                  <th style={{ textAlign: 'right' }}>CPC</th>
                  <th style={{ textAlign: 'right' }}>비용</th>
                  <th style={{ textAlign: 'right' }}>전환</th>
                  <th>시작일</th>
                </tr>
              </thead>
              <tbody>
                {visibleSummaries.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <b>{c.name}</b>
                      <div className="muted" style={{ fontSize: 11 }}>{c.id}</div>
                    </td>
                    <td>{statusPill(c.status)}</td>
                    <td className="muted" style={{ fontSize: 11 }}>{c.channel_type}</td>
                    <td style={{ textAlign: 'right' }}>{c.impressions > 0 ? fmt(c.impressions) : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{c.clicks > 0 ? fmt(c.clicks) : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{c.impressions > 0 ? `${c.ctr.toFixed(2)}%` : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{c.clicks > 0 ? `₩${fmt(Math.round(c.cpc))}` : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{c.cost_krw > 0 ? `₩${fmt(c.cost_krw)}` : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{c.conversions > 0 ? c.conversions.toFixed(2) : '-'}</td>
                    <td className="muted" style={{ fontSize: 11 }}>{c.start_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
          * 실적(노출/클릭/비용)은 최근 30일 기준. PAUSED/REMOVED 캠페인은 30일 내 활동이 없으면 "-"로 표시됩니다.
        </p>
      </section>
    </main>
  )
}
