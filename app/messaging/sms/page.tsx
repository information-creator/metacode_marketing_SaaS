import type { NormalizedDailyRow } from '@/lib/channels/sol/adapter'
import { querySolRows } from '@/lib/queries'
import { SubTypeBarChart } from '../../chart'
import { DateRangeTabs } from '@/app/_components/date-range-tabs'
import { parseDateRange, rangeToDays, rangeFilter, rangeLabel } from '@/app/_components/date-range'
import { gradeColor, gradeFromRatio, gradeLabel, smsSuccessBenchmark } from '@/lib/benchmarks'

export const dynamic = 'force-dynamic'

const SUB_TYPE_LABEL: Record<string, string> = {
  sms: 'SMS (단문)',
  lms: 'LMS (장문)',
  mms: 'MMS (이미지)',
}

const SUB_TYPE_COLOR: Record<string, string> = {
  sms: '#22c55e',
  lms: '#0ea5e9',
  mms: '#a78bfa',
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

export default async function SmsDetailPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string; from?: string; to?: string }>
}) {
  const params = (await searchParams) ?? {}
  const range = parseDateRange(params, 30)

  let rows: NormalizedDailyRow[] = []
  let error: string | null = null
  try {
    const all = await querySolRows(range)
    rows = all.filter((r) => r.channel === 'sms')
  } catch (e) {
    error = (e as Error).message
  }

  const subTypes = Array.from(new Set(rows.map((r) => r.sub_type)))
  const summary = subTypes
    .map((st) => {
      const subset = rows.filter((r) => r.sub_type === st)
      const sent = subset.reduce((a, r) => a + r.sent, 0)
      const successed = subset.reduce((a, r) => a + r.successed, 0)
      const failed = subset.reduce((a, r) => a + r.failed, 0)
      const cost = subset.reduce((a, r) => a + r.cost_krw, 0)
      const rate = sent > 0 ? (successed / sent) * 100 : 0
      return { st, sent, successed, failed, cost, rate }
    })
    .sort((a, b) => b.sent - a.sent)

  const total = summary.reduce(
    (a, s) => ({
      sent: a.sent + s.sent,
      successed: a.successed + s.successed,
      failed: a.failed + s.failed,
      cost: a.cost + s.cost,
    }),
    { sent: 0, successed: 0, failed: 0, cost: 0 },
  )
  const successRate = total.sent > 0 ? (total.successed / total.sent) * 100 : 0
  const costPerMsg = total.sent > 0 ? total.cost / total.sent : 0

  const bm = smsSuccessBenchmark(successRate)
  const ratio = bm.value / bm.avg
  const grade = gradeFromRatio(ratio, true)
  const color = gradeColor(grade)
  const diff = ((ratio - 1) * 100).toFixed(1)
  const diffSign = ratio >= 1 ? '+' : ''
  const advice =
    grade === 'excellent' ? '거의 완벽한 전달률이에요. 현재 발송 품질을 유지하세요.' :
    grade === 'good' ? '업계 평균 이상. 수신 거부/무효 번호 관리가 잘 되고 있습니다.' :
    grade === 'average' ? '정상 수준. 실패 사유 상위 케이스를 확인해볼 여지 있음.' :
    grade === 'below' ? '전달률이 다소 낮음. 수신 번호 정비 또는 발신자 등록 상태 점검 필요.' :
    '전달 실패율이 높습니다. 번호 DB 클렌징, 스팸 등록 여부, 발신번호 인증 상태 우선 점검.'

  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">문자 (SMS / LMS / MMS)</h1>
        <p className="page-subtitle">문자하랑 (SOL API) · {rangeLabel(range)} · 타입별 분해</p>
      </header>

      <DateRangeTabs basePath="/messaging/sms" range={range} />

      {error && <div className="error-banner">수집 실패: {error}</div>}

      {summary.length === 0 && !error && (
        <div className="card">
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>이 기간에 SMS 발송 기록이 없습니다.</p>
        </div>
      )}

      {summary.length > 0 && (
        <>
          <section className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${color}` }}>
            <div className="kpi-label" style={{ marginBottom: 6 }}>업계 평균 대비 평가</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>성공률 {successRate.toFixed(1)}%</div>
              <span style={{ color, fontSize: 13, fontWeight: 600 }}>{gradeLabel(grade)}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                업계 평균({bm.avg}%) 대비 <b style={{ color }}>{diffSign}{diff}%p</b>
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>{advice}</p>
          </section>

          <section className="grid grid-4" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="kpi-label">총 발송</div>
              <div className="kpi-value">{fmt(total.sent)}건</div>
              <div className="kpi-sub">{subTypes.length}개 타입</div>
            </div>
            <div className="card">
              <div className="kpi-label">성공률</div>
              <div className="kpi-value" style={{ color }}>{successRate.toFixed(1)}%</div>
              <div className="kpi-sub">
                성공 {fmt(total.successed)} · 실패 {fmt(total.failed)}
              </div>
            </div>
            <div className="card">
              <div className="kpi-label">총 비용</div>
              <div className="kpi-value">₩{fmt(total.cost)}</div>
              <div className="kpi-sub">{rangeLabel(range)}</div>
            </div>
            <div className="card">
              <div className="kpi-label">건당 평균</div>
              <div className="kpi-value">₩{fmt(Math.round(costPerMsg))}</div>
              <div className="kpi-sub">LMS 표준 ₩33 대비</div>
            </div>
          </section>

          <section className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              일별 발송 (타입별)
            </h2>
            <SubTypeBarChart rows={rows} colorMap={SUB_TYPE_COLOR} />
          </section>

          <section className="card">
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              타입별 성과
            </h2>
            <table className="data">
              <thead>
                <tr>
                  <th>타입</th>
                  <th style={{ textAlign: 'right' }}>발송</th>
                  <th style={{ textAlign: 'right' }}>성공</th>
                  <th style={{ textAlign: 'right' }}>실패</th>
                  <th style={{ textAlign: 'right' }}>성공률</th>
                  <th style={{ textAlign: 'right' }}>비용</th>
                  <th style={{ textAlign: 'right' }}>건당</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.st}>
                    <td>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: SUB_TYPE_COLOR[s.st] ?? '#64748b', marginRight: 8 }} />
                      <b>{SUB_TYPE_LABEL[s.st] ?? s.st.toUpperCase()}</b>
                    </td>
                    <td style={{ textAlign: 'right' }}>{fmt(s.sent)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(s.successed)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(s.failed)}</td>
                    <td style={{ textAlign: 'right' }}>{s.rate.toFixed(1)}%</td>
                    <td style={{ textAlign: 'right' }}>₩{fmt(s.cost)}</td>
                    <td style={{ textAlign: 'right' }}>₩{fmt(Math.round(s.sent > 0 ? s.cost / s.sent : 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  )
}
