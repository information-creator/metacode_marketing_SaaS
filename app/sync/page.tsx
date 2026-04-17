import { fetchSolBalance, fetchSolDailyRows, type NormalizedDailyRow } from '@/lib/channels/sol/adapter'
import { fetchGoogleAdsDailyRows, aggregateGoogleAds } from '@/lib/channels/google-ads/adapter'
import { fetchMetaAdsDailyRows, aggregateMetaAds } from '@/lib/channels/meta-ads/adapter'

export const dynamic = 'force-dynamic'

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

type ChannelStatus = {
  name: string
  key: string
  status: 'ok' | 'warn' | 'bad' | 'pending'
  detail: string
  lastSyncAt?: string
}

export default async function SyncPage() {
  const channels: ChannelStatus[] = []

  const startedAt = new Date()
  let solError: string | null = null
  let balance: Awaited<ReturnType<typeof fetchSolBalance>> | null = null
  let rows: NormalizedDailyRow[] = []

  try {
    const [b, r] = await Promise.all([fetchSolBalance(), fetchSolDailyRows(7)])
    balance = b
    rows = r
  } catch (e) {
    solError = (e as Error).message
  }

  const solSent = rows.reduce((a, r) => a + r.sent, 0)
  channels.push({
    name: '문자하랑 (SOL)',
    key: 'sms_solapi',
    status: solError ? 'bad' : 'ok',
    detail: solError
      ? solError
      : `잔액 ₩${fmt(balance?.balance ?? 0)} · 최근 7일 발송 ${fmt(solSent)}건`,
    lastSyncAt: solError ? undefined : startedAt.toISOString(),
  })

  channels.push({
    name: '카카오 비즈',
    key: 'kakao_biz',
    status: 'ok',
    detail: 'SOL 통합 수집 (별도 API 없음)',
  })

  let gadsError: string | null = null
  let gadsAgg: ReturnType<typeof aggregateGoogleAds> | null = null
  try {
    const gadsRows = await fetchGoogleAdsDailyRows(7)
    gadsAgg = aggregateGoogleAds(gadsRows)
  } catch (e) {
    gadsError = (e as Error).message
  }
  channels.push({
    name: 'Google Ads',
    key: 'google_ads',
    status: gadsError ? 'bad' : 'ok',
    detail: gadsError
      ? gadsError
      : `최근 7일 비용 ₩${fmt(gadsAgg?.total.cost_krw ?? 0)} · 클릭 ${fmt(gadsAgg?.total.clicks ?? 0)}`,
    lastSyncAt: gadsError ? undefined : new Date().toISOString(),
  })

  let metaError: string | null = null
  let metaAgg: ReturnType<typeof aggregateMetaAds> | null = null
  try {
    const metaRows = await fetchMetaAdsDailyRows(7)
    metaAgg = aggregateMetaAds(metaRows)
  } catch (e) {
    metaError = (e as Error).message
  }
  channels.push({
    name: 'Meta Ads',
    key: 'meta_ads',
    status: metaError ? 'bad' : 'ok',
    detail: metaError
      ? metaError
      : `최근 7일 비용 ₩${fmt(metaAgg?.total.cost_krw ?? 0)} · 클릭 ${fmt(metaAgg?.total.clicks ?? 0)} · 도달 ${fmt(metaAgg?.total.reach ?? 0)}`,
    lastSyncAt: metaError ? undefined : new Date().toISOString(),
  })

  const statusPill = (s: ChannelStatus['status']) => {
    if (s === 'ok') return <span className="pill ok">● OK</span>
    if (s === 'warn') return <span className="pill warn">● 지연</span>
    if (s === 'bad') return <span className="pill bad">● 실패</span>
    return <span className="pill">● 미연동</span>
  }

  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">Sync Status</h1>
        <p className="page-subtitle">채널별 수집 상태 · 잔액 · 최종 연결 시각</p>
      </header>

      {balance && (
        <section className="grid grid-3" style={{ marginBottom: 24 }}>
          <div className="card">
            <div className="kpi-label">SOL 잔액 (충전)</div>
            <div className="kpi-value">₩{fmt(balance.balance)}</div>
            <div className="kpi-sub">포인트 ₩{fmt(balance.point)}</div>
          </div>
          <div className="card">
            <div className="kpi-label">SOL 예치금</div>
            <div className="kpi-value">₩{fmt(balance.deposit)}</div>
            <div className="kpi-sub">최소 충전 ₩{fmt(balance.minimumCash)}</div>
          </div>
          <div className="card">
            <div className="kpi-label">자동 충전</div>
            <div className="kpi-value">{balance.autoRecharge ? 'ON' : 'OFF'}</div>
            <div className="kpi-sub">자동 재충전 설정 상태</div>
          </div>
        </section>
      )}

      <section className="card">
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          채널 연결 상태
        </h2>
        <table className="data">
          <thead>
            <tr>
              <th>채널</th>
              <th>상태</th>
              <th>상세</th>
              <th>최종 수집</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.key}>
                <td><b>{c.name}</b></td>
                <td>{statusPill(c.status)}</td>
                <td className="muted">{c.detail}</td>
                <td className="muted">{c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString('ko-KR') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 18, fontSize: 12 }} className="muted">
        <p style={{ margin: 0 }}>
          현재 A 단계(데모) — 페이지 열 때마다 SOL API를 직접 호출합니다. B 단계에서 Supabase + Vercel Cron으로 주기 수집 전환 예정.
        </p>
      </section>
    </main>
  )
}
