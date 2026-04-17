import Link from 'next/link'
import { aggregateByChannel, type NormalizedDailyRow } from '@/lib/channels/sol/adapter'
import { querySolRows } from '@/lib/queries'
import { DateRangeTabs } from '@/app/_components/date-range-tabs'
import { parseDateRange, rangeFilter, rangeLabel, rangeToDays } from '@/app/_components/date-range'
import { OverviewChart } from '../chart'
import { gradeColor, gradeFromRatio, gradeLabel, kakaoSuccessBenchmark, smsSuccessBenchmark } from '@/lib/benchmarks'

export const dynamic = 'force-dynamic'

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

export default async function MessagingOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string; from?: string; to?: string }>
}) {
  const params = (await searchParams) ?? {}
  const range = parseDateRange(params, 90)

  let rows: NormalizedDailyRow[] = []
  let error: string | null = null
  try {
    rows = await querySolRows(range)
  } catch (e) {
    error = (e as Error).message
  }

  const agg = aggregateByChannel(rows)
  const smsTotal = agg.sms.sent + agg.other.sent
  const kakaoTotal = agg.kakao_biz.sent
  const totalSent = smsTotal + kakaoTotal
  const smsSuccess = agg.sms.successed + agg.other.successed
  const kakaoSuccess = agg.kakao_biz.successed
  const smsCost = agg.sms.cost_krw + agg.other.cost_krw
  const kakaoCost = agg.kakao_biz.cost_krw

  const smsSuccessRate = smsTotal > 0 ? (smsSuccess / smsTotal) * 100 : 0
  const kakaoSuccessRate = kakaoTotal > 0 ? (kakaoSuccess / kakaoTotal) * 100 : 0

  const smsPct = totalSent > 0 ? (smsTotal / totalSent) * 100 : 0
  const kakaoPct = totalSent > 0 ? (kakaoTotal / totalSent) * 100 : 0

  const solRowsByChannel = {
    sms: rows.filter((r) => r.channel === 'sms' || r.channel === 'other'),
    kakao: rows.filter((r) => r.channel === 'kakao_biz'),
  }

  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">문자하랑 종합</h1>
        <p className="page-subtitle">
          SOL API 하나로 수집 · 문자와 카카오톡을 분리하여 표시 · {rangeLabel(range)}
        </p>
      </header>

      <DateRangeTabs basePath="/messaging" range={range} />

      {error && <div className="error-banner">수집 실패: {error}</div>}

      <section className="grid grid-2" style={{ marginBottom: 16 }}>
        <Link href="/messaging/sms" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', borderLeft: '4px solid #22c55e', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>💬</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>문자 (SMS / LMS / MMS)</div>
                <div className="muted" style={{ fontSize: 11 }}>단문 · 장문 · 이미지</div>
              </div>
            </div>
            <div className="kpi-value">{fmt(smsTotal)}건</div>
            <div className="kpi-sub">
              성공률 {smsSuccessRate.toFixed(1)}% · ₩{fmt(smsCost)} · 전체의 {smsPct.toFixed(0)}%
            </div>
            <div style={{ marginTop: 14, background: 'var(--panel-2)', height: 4, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${smsPct}%`, height: '100%', background: '#22c55e' }} />
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 14 }}>클릭하여 상세 보기 →</div>
          </div>
        </Link>

        <Link href="/messaging/kakao" style={{ textDecoration: 'none' }}>
          <div className="card" style={{ cursor: 'pointer', borderLeft: '4px solid #fbbf24', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>💛</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>카카오톡 (알림톡 / 친구톡)</div>
                <div className="muted" style={{ fontSize: 11 }}>알림톡 · 친구톡(텍스트/이미지) · BMS</div>
              </div>
            </div>
            <div className="kpi-value">{fmt(kakaoTotal)}건</div>
            <div className="kpi-sub">
              {kakaoTotal > 0
                ? `성공률 ${kakaoSuccessRate.toFixed(1)}% · ₩${fmt(kakaoCost)} · 전체의 ${kakaoPct.toFixed(0)}%`
                : '현재 발송 기록 없음 (발송 시작하면 자동 집계)'}
            </div>
            <div style={{ marginTop: 14, background: 'var(--panel-2)', height: 4, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${kakaoPct}%`, height: '100%', background: '#fbbf24' }} />
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 14 }}>클릭하여 상세 보기 →</div>
          </div>
        </Link>
      </section>

      {(() => {
        const evals: Array<{
          ch: string
          rate: number
          bm: ReturnType<typeof smsSuccessBenchmark>
          grade: ReturnType<typeof gradeFromRatio>
          color: string
          advice: string
        }> = []
        if (smsTotal > 0) {
          const bm = smsSuccessBenchmark(smsSuccessRate)
          const grade = gradeFromRatio(bm.value / bm.avg, true)
          evals.push({
            ch: '문자',
            rate: smsSuccessRate,
            bm,
            grade,
            color: gradeColor(grade),
            advice:
              grade === 'excellent' ? '거의 완벽한 전달률. 현재 발송 품질 유지.' :
              grade === 'good' ? '업계 평균 이상. 수신 번호 관리가 잘 되고 있음.' :
              grade === 'average' ? '정상 수준. 실패 상위 사유 점검 여지 있음.' :
              grade === 'below' ? '전달률이 다소 낮음. 수신 DB 또는 발신자 인증 점검 필요.' :
              '실패율 높음. 번호 클렌징 · 스팸 등록 · 발신번호 인증 우선 점검.',
          })
        }
        if (kakaoTotal > 0) {
          const bm = kakaoSuccessBenchmark(kakaoSuccessRate)
          const grade = gradeFromRatio(bm.value / bm.avg, true)
          evals.push({
            ch: '카카오톡',
            rate: kakaoSuccessRate,
            bm,
            grade,
            color: gradeColor(grade),
            advice:
              grade === 'excellent' ? '알림톡 전달률 우수. 템플릿 승인 상태 안정.' :
              grade === 'good' ? '양호. 카카오톡 발송에 문제 없음.' :
              grade === 'average' ? '일반적 수준. 수신 거부·차단 사용자 비율 확인 권장.' :
              grade === 'below' ? '전달률 미흡. 채널 친구 맺기 상태 또는 템플릿 승인 문제 점검.' :
              '전달 실패 다수. 발신 프로필 상태 · 템플릿 재심사 필요성 확인.',
          })
        }
        if (evals.length === 0) return null
        return (
          <section className={`grid grid-${evals.length}`} style={{ marginBottom: 16 }}>
            {evals.map((e) => {
              const diff = ((e.bm.value / e.bm.avg - 1) * 100).toFixed(1)
              const diffSign = e.bm.value >= e.bm.avg ? '+' : ''
              return (
                <div key={e.ch} className="card" style={{ borderLeft: `4px solid ${e.color}` }}>
                  <div className="kpi-label" style={{ marginBottom: 6 }}>업계 평균 대비 — {e.ch}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>전달률 {e.rate.toFixed(1)}%</div>
                    <span style={{ color: e.color, fontSize: 13, fontWeight: 600 }}>{gradeLabel(e.grade)}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    업계 평균({e.bm.avg}%) 대비 <b style={{ color: e.color }}>{diffSign}{diff}%p</b>
                  </div>
                  <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>{e.advice}</p>
                </div>
              )
            })}
          </section>
        )
      })()}

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          채널별 비교
        </h2>
        <table className="data">
          <thead>
            <tr>
              <th>채널</th>
              <th style={{ textAlign: 'right' }}>발송량</th>
              <th style={{ textAlign: 'right' }}>점유율</th>
              <th style={{ textAlign: 'right' }}>성공</th>
              <th style={{ textAlign: 'right' }}>실패</th>
              <th style={{ textAlign: 'right' }}>성공률</th>
              <th style={{ textAlign: 'right' }}>비용</th>
              <th style={{ textAlign: 'right' }}>건당</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: '#22c55e', marginRight: 8 }} />
                <b>문자</b>
              </td>
              <td style={{ textAlign: 'right' }}>{fmt(smsTotal)}건</td>
              <td style={{ textAlign: 'right' }}>{smsPct.toFixed(1)}%</td>
              <td style={{ textAlign: 'right' }}>{fmt(smsSuccess)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(smsTotal - smsSuccess)}</td>
              <td style={{ textAlign: 'right' }}>{smsSuccessRate.toFixed(1)}%</td>
              <td style={{ textAlign: 'right' }}>₩{fmt(smsCost)}</td>
              <td style={{ textAlign: 'right' }}>₩{fmt(smsTotal > 0 ? Math.round(smsCost / smsTotal) : 0)}</td>
            </tr>
            <tr>
              <td>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: '#fbbf24', marginRight: 8 }} />
                <b>카카오톡</b>
              </td>
              <td style={{ textAlign: 'right' }}>{fmt(kakaoTotal)}건</td>
              <td style={{ textAlign: 'right' }}>{kakaoPct.toFixed(1)}%</td>
              <td style={{ textAlign: 'right' }}>{fmt(kakaoSuccess)}</td>
              <td style={{ textAlign: 'right' }}>{fmt(kakaoTotal - kakaoSuccess)}</td>
              <td style={{ textAlign: 'right' }}>{kakaoTotal > 0 ? `${kakaoSuccessRate.toFixed(1)}%` : '-'}</td>
              <td style={{ textAlign: 'right' }}>₩{fmt(kakaoCost)}</td>
              <td style={{ textAlign: 'right' }}>{kakaoTotal > 0 ? `₩${fmt(Math.round(kakaoCost / kakaoTotal))}` : '-'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          일별 발송 추이 (채널 분리)
        </h2>
        <OverviewChart
          solRows={rows}
          googleRows={[]}
          metaRows={[]}
        />
      </section>
    </main>
  )
}
