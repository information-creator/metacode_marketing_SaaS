import { aggregateByChannel, type NormalizedDailyRow } from '@/lib/channels/sol/adapter'
import { aggregateGoogleAds, type GoogleAdsDailyRow } from '@/lib/channels/google-ads/adapter'
import { aggregateMetaAds, type MetaAdsDailyRow } from '@/lib/channels/meta-ads/adapter'
import { queryGoogleDailyRows, queryMetaDailyRows, querySolRows } from '@/lib/queries'
import {
  gradeFromRatio,
  googleCtrBenchmark,
  kakaoSuccessBenchmark,
  metaCpmBenchmark,
  metaCtrBenchmark,
  smsSuccessBenchmark,
  type Benchmark,
  type BenchmarkGrade,
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
  const fullRange = { mode: 'days' as const, days: days * 2 }

  const [solRes, googleRes, metaRes] = await Promise.allSettled([
    querySolRows(fullRange),
    queryGoogleDailyRows(fullRange),
    queryMetaDailyRows(fullRange),
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

  // Per-channel success rates (split SMS vs Kakao)
  const smsOnlySent = solAgg.sms.sent + solAgg.other.sent
  const smsOnlySuccess = solAgg.sms.successed + solAgg.other.successed
  const smsOnlyRate = smsOnlySent > 0 ? (smsOnlySuccess / smsOnlySent) * 100 : 0

  const kakaoSent = solAgg.kakao_biz.sent
  const kakaoSuccess = solAgg.kakao_biz.successed
  const kakaoRate = kakaoSent > 0 ? (kakaoSuccess / kakaoSent) * 100 : 0

  // Per-channel status (Google / Meta / SMS / Kakao)
  type ChannelStatus = {
    key: string
    name: string
    source?: string           // 수집 출처 표시 (예: 문자하랑)
    emoji: string
    hasData: boolean
    keyMetricLabel: string   // e.g. "CTR", "성공률"
    keyMetricValue: string   // formatted
    avgValue: string
    diffPct: number          // signed % vs avg
    grade: BenchmarkGrade | null
    statusEmoji: string
    statusLabel: string
    statusColor: string
    advice: string
  }

  const GRADE_ORDER: Record<BenchmarkGrade, number> = { poor: 0, below: 1, average: 2, good: 3, excellent: 4 }

  function buildStatus(
    key: string, name: string, source: string | undefined, emoji: string, hasData: boolean, benchmarks: Benchmark[], adviceMap: Record<BenchmarkGrade, string>,
  ): ChannelStatus {
    if (!hasData || benchmarks.length === 0) {
      return {
        key, name, source, emoji, hasData,
        keyMetricLabel: '-', keyMetricValue: '-', avgValue: '-', diffPct: 0, grade: null,
        statusEmoji: '⚪', statusLabel: '데이터 없음', statusColor: '#a1a1aa',
        advice: '아직 수집된 데이터가 없습니다.',
      }
    }
    const withGrade = benchmarks.map((b) => ({
      bm: b,
      grade: gradeFromRatio(b.value / b.avg, b.higherIsBetter),
      normalized: b.higherIsBetter ? b.value / b.avg : b.avg / Math.max(b.value, 0.0001),
    }))
    const worst = [...withGrade].sort((a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || a.normalized - b.normalized)[0]
    const isBad = worst.grade === 'below' || worst.grade === 'poor'
    const isAvg = worst.grade === 'average'
    const diffPct = Math.round((worst.bm.value / worst.bm.avg - 1) * 100)
    return {
      key, name, source, emoji, hasData,
      keyMetricLabel: worst.bm.label.replace(`${name} `, '').replace('문자 ', '').replace('카카오톡 ', ''),
      keyMetricValue: worst.bm.format(worst.bm.value),
      avgValue: worst.bm.format(worst.bm.avg),
      diffPct,
      grade: worst.grade,
      statusEmoji: isBad ? '🔴' : isAvg ? '🟡' : '🟢',
      statusLabel: isBad ? '점검 필요' : isAvg ? '보통' : '양호',
      statusColor: isBad ? '#ef4444' : isAvg ? '#eab308' : '#16a34a',
      advice: adviceMap[worst.grade],
    }
  }

  const googleStatus = buildStatus('google', 'Google Ads', undefined, '🔍', googleNow.length > 0,
    googleNow.length > 0 ? [googleCtrBenchmark(gAgg.ctr)] : [],
    {
      excellent: '광고 카피·타겟팅 매우 잘 맞음. 예산 확대 고려 가능.',
      good: '업계 평균 이상. 현재 방향 유지.',
      average: '평균 수준. 카피 리프레시·키워드 재조정 여지.',
      below: '업계 평균 미달. 광고 소재·키워드 적합성 점검 필요.',
      poor: '즉시 점검. 소재 교체·타겟 재설정·랜딩 관련성 재검토.',
    })

  const metaStatus = buildStatus('meta', 'Meta Ads', undefined, '📘', metaNow.length > 0,
    metaNow.length > 0 ? [metaCtrBenchmark(mAgg.ctr), metaCpmBenchmark(mAgg.cpm)] : [],
    {
      excellent: '소재·오디언스 최적. 예산 확대 여지.',
      good: '업계 평균 이상. 유지.',
      average: '평균 수준. 소재 A/B·오디언스 재조정 여지.',
      below: '광고 소재·타겟팅 점검 권장.',
      poor: '소재 교체 + 오디언스 리셋 + 입찰 전략 재조정 필요.',
    })

  const smsStatus = buildStatus('sms', '문자', '문자하랑', '💬', smsOnlySent > 0,
    smsOnlySent > 0 ? [smsSuccessBenchmark(smsOnlyRate)] : [],
    {
      excellent: '거의 완벽한 전달률. 현재 발송 품질 유지.',
      good: '업계 평균 이상. 수신 번호 관리 잘 되고 있음.',
      average: '정상 수준. 실패 상위 사유 확인 여지.',
      below: '전달률이 낮음. 수신 DB·발신자 인증 점검 필요.',
      poor: '실패율 높음. 번호 클렌징·스팸 등록·발신번호 인증 우선 점검.',
    })

  const kakaoStatus = buildStatus('kakao', '카카오톡', '문자하랑', '💛', kakaoSent > 0,
    kakaoSent > 0 ? [kakaoSuccessBenchmark(kakaoRate)] : [],
    {
      excellent: '알림톡 전달률 우수. 템플릿 승인 상태 안정.',
      good: '양호. 카카오 발송 문제 없음.',
      average: '일반적 수준. 수신 거부·차단 비율 확인 권장.',
      below: '전달률 미흡. 채널 친구 맺기·템플릿 승인 점검.',
      poor: '전달 실패 다수. 발신 프로필·템플릿 재심사 필요.',
    })

  const channelStatuses = [googleStatus, metaStatus, smsStatus, kakaoStatus]
  const activeChannels = channelStatuses.filter((c) => c.hasData)

  // Overall verdict (from channel statuses)
  const hasBad = activeChannels.some((c) => c.statusEmoji === '🔴')
  const hasAvg = activeChannels.some((c) => c.statusEmoji === '🟡')
  const verdict = activeChannels.length === 0
    ? { emoji: '⚪', label: '데이터 수집 중', color: '#a1a1aa' }
    : hasBad
    ? { emoji: '🔴', label: '즉시 조치 필요', color: '#ef4444' }
    : hasAvg
    ? { emoji: '🟡', label: '한 곳 점검 필요', color: '#eab308' }
    : { emoji: '🟢', label: '잘 하고 있어요', color: '#16a34a' }

  // Worst channel to call out
  const worstChannel = [...activeChannels].sort((a, b) => {
    const ae = a.statusEmoji === '🔴' ? 0 : a.statusEmoji === '🟡' ? 1 : 2
    const be = b.statusEmoji === '🔴' ? 0 : b.statusEmoji === '🟡' ? 1 : 2
    return ae - be || a.diffPct - b.diffPct
  })[0]

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

      <section className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${verdict.color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>{verdict.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              지금 잘 하고 있나요
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: verdict.color, lineHeight: 1.15 }}>
              {verdict.label}
            </div>
            {worstChannel && verdict.emoji !== '🟢' && verdict.emoji !== '⚪' && (
              <div style={{ fontSize: 13, marginTop: 6, color: 'var(--muted)' }}>
                <b style={{ color: 'var(--text)' }}>{worstChannel.name}</b> — {worstChannel.advice}
              </div>
            )}
            {verdict.emoji === '🟢' && (
              <div style={{ fontSize: 13, marginTop: 6, color: 'var(--muted)' }}>
                {activeChannels.length}개 채널 모두 업계 평균 이상. 현재 운영 유지.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-4" style={{ marginBottom: 20 }}>
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
          <div className="kpi-sub" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>💬 문자 {fmt(smsOnlySent)}건 · 성공률 {smsOnlyRate.toFixed(1)}%</span>
            <span>💛 카카오 {fmt(kakaoSent)}건{kakaoSent > 0 ? ` · 성공률 ${kakaoRate.toFixed(1)}%` : ''}</span>
            <span style={{ opacity: 0.75 }}><DeltaBadge current={messageCount} previous={messageCountPrev} /> 전기간 대비</span>
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

      {/* Per-channel status grid — 4 big cards */}
      <section className="grid grid-4" style={{ marginBottom: 20 }}>
        {channelStatuses.map((c) => (
          <div key={c.key} className="card" style={{ borderLeft: `4px solid ${c.statusColor}`, opacity: c.hasData ? 1 : 0.55 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{c.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {c.name}
                  {c.source && (
                    <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--muted)', marginLeft: 5 }}>({c.source})</span>
                  )}
                </span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#fff',
                background: c.statusColor, padding: '2px 8px', borderRadius: 999,
              }}>
                {c.statusEmoji} {c.statusLabel}
              </span>
            </div>
            {c.hasData ? (
              <>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{c.keyMetricLabel}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 700 }}>{c.keyMetricValue}</span>
                  <span style={{ fontSize: 12, color: c.statusColor, fontWeight: 600 }}>
                    {c.diffPct >= 0 ? '+' : ''}{c.diffPct}%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
                  업계 평균 {c.avgValue}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 }}>
                  {c.advice}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>
                아직 수집된 데이터가 없습니다.
              </div>
            )}
          </div>
        ))}
      </section>

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
