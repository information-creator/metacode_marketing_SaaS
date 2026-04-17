import { fetchSolBalance } from '@/lib/channels/sol/adapter'
import { queryLastSyncRuns } from '@/lib/queries'

export const dynamic = 'force-dynamic'

const CHANNEL_NAME: Record<string, string> = {
  sms_solapi: '문자하랑 (SOL)',
  kakao_biz: '카카오 비즈',
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

export default async function SyncPage() {
  let solError: string | null = null
  let balance: Awaited<ReturnType<typeof fetchSolBalance>> | null = null
  try {
    balance = await fetchSolBalance()
  } catch (e) {
    solError = (e as Error).message
  }

  let runs: Awaited<ReturnType<typeof queryLastSyncRuns>> = []
  let runsError: string | null = null
  try {
    runs = await queryLastSyncRuns()
  } catch (e) {
    runsError = (e as Error).message
  }

  function statusPill(status: string) {
    if (status === 'success') return <span className="pill ok">● 성공</span>
    if (status === 'running') return <span className="pill warn">● 진행 중</span>
    if (status === 'partial') return <span className="pill warn">● 일부 성공</span>
    if (status === 'failed') return <span className="pill bad">● 실패</span>
    return <span className="pill">● {status}</span>
  }

  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">Sync Status</h1>
        <p className="page-subtitle">Supabase 기반 수집 파이프라인 · Vercel Cron 스케줄 · 채널별 최근 실행</p>
      </header>

      {solError && <div className="error-banner">SOL 잔액 조회 실패: {solError}</div>}
      {runsError && <div className="error-banner">sync_runs 조회 실패: {runsError}</div>}

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            채널별 최근 수집 실행
          </h2>
          <span className="muted" style={{ fontSize: 11 }}>
            크론: SOL 30분 / 광고 3시간 간격
          </span>
        </div>

        {runs.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>아직 수집 기록이 없습니다. 수동 수집: <code>POST /api/sync/&#123;channel&#125;</code></p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>채널</th>
                <th>상태</th>
                <th style={{ textAlign: 'right' }}>업서트 행</th>
                <th>최종 완료</th>
                <th>에러</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.channel}>
                  <td><b>{CHANNEL_NAME[r.channel] ?? r.channel}</b></td>
                  <td>{statusPill(r.status)}</td>
                  <td style={{ textAlign: 'right' }}>{r.rows_upserted != null ? fmt(r.rows_upserted) : '-'}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {r.finished_at ? new Date(r.finished_at).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="muted" style={{ fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.error ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 18, fontSize: 12 }} className="muted">
        <p style={{ margin: 0 }}>
          모든 대시보드 페이지는 Supabase DB에서 데이터를 읽습니다 (3시간 지연 허용). API 직접 호출은 크론이 수행합니다.
        </p>
      </section>
    </main>
  )
}
