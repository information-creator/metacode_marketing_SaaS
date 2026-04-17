import { fetchSolDailyRows, type NormalizedDailyRow } from '@/lib/channels/sol/adapter'
import { SubTypeBarChart } from '../../chart'
import { DateRangeTabs } from '@/app/_components/date-range-tabs'
import { parseDateRange, rangeFilter, rangeLabel, rangeToDays } from '@/app/_components/date-range'
import { gradeColor, gradeFromRatio, gradeLabel, kakaoSuccessBenchmark } from '@/lib/benchmarks'

export const dynamic = 'force-dynamic'

const SUB_TYPE_LABEL: Record<string, string> = {
  ata: '알림톡',
  cta: '친구톡 (텍스트)',
  cti: '친구톡 (이미지)',
  bms_text: 'BMS 텍스트',
  bms_image: 'BMS 이미지',
  bms_wide: 'BMS 와이드',
}

const SUB_TYPE_COLOR: Record<string, string> = {
  ata: '#fbbf24',
  cta: '#f59e0b',
  cti: '#ef4444',
  bms_text: '#a78bfa',
  bms_image: '#8b5cf6',
  bms_wide: '#6366f1',
}

function fmt(n: number): string {
  return n.toLocaleString('ko-KR')
}

export default async function KakaoDetailPage({
  searchParams,
}: {
  searchParams?: Promise<{ days?: string; from?: string; to?: string }>
}) {
  const params = (await searchParams) ?? {}
  const range = parseDateRange(params, 90)
  const fetchDays = rangeToDays(range)

  let rows: NormalizedDailyRow[] = []
  let error: string | null = null
  try {
    const all = await fetchSolDailyRows(fetchDays)
    rows = rangeFilter(all.filter((r) => r.channel === 'kakao_biz'), range)
  } catch (e) {
    error = (e as Error).message
  }

  const hasData = rows.length > 0

  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">카카오톡 (알림톡 / 친구톡)</h1>
        <p className="page-subtitle">
          {rangeLabel(range)} · 문자하랑 (SOL API) 통합 수집 · 별도 API 불필요
        </p>
      </header>

      <DateRangeTabs basePath="/messaging/kakao" range={range} />

      {error && <div className="error-banner">수집 실패: {error}</div>}

      <section style={{ marginBottom: 24 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 22 }}>{hasData ? '🟢' : '⚪'}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
              {hasData ? '카카오 발송 데이터 수집 중' : '아직 카카오 발송 기록 없음'}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {hasData
                ? `${rangeLabel(range)} 동안 ${fmt(rows.reduce((a, r) => a + r.sent, 0))}건의 카카오 발송이 감지됨`
                : '발신프로필 + 템플릿 등록 후 알림톡을 보내면 자동으로 여기에 집계됩니다'}
            </div>
          </div>
        </div>
      </section>

      {hasData && (() => {
        const total = rows.reduce((a, r) => a + r.sent, 0)
        const success = rows.reduce((a, r) => a + r.successed, 0)
        const rate = total > 0 ? (success / total) * 100 : 0
        const bm = kakaoSuccessBenchmark(rate)
        const grade = gradeFromRatio(bm.value / bm.avg, true)
        const color = gradeColor(grade)
        const diff = ((bm.value / bm.avg - 1) * 100).toFixed(1)
        const diffSign = bm.value >= bm.avg ? '+' : ''
        const advice =
          grade === 'excellent' ? '알림톡 전달률 우수. 템플릿 승인 상태 안정.' :
          grade === 'good' ? '양호한 전달률. 발송 품질 유지.' :
          grade === 'average' ? '일반적 수준. 수신 거부·차단 사용자 비율 확인 권장.' :
          grade === 'below' ? '전달률 미흡. 채널 친구 맺기 / 템플릿 승인 문제 점검.' :
          '전달 실패 다수. 발신 프로필 상태 · 템플릿 재심사 필요.'
        return (
          <section className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${color}` }}>
            <div className="kpi-label" style={{ marginBottom: 6 }}>업계 평균 대비 평가</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>전달률 {rate.toFixed(1)}%</div>
              <span style={{ color, fontSize: 13, fontWeight: 600 }}>{gradeLabel(grade)}</span>
              <span className="muted" style={{ fontSize: 12 }}>
                업계 평균({bm.avg}%) 대비 <b style={{ color }}>{diffSign}{diff}%p</b>
              </span>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>{advice}</p>
          </section>
        )
      })()}

      {hasData && (
        <>
          <section className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 16px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              일별 발송 (유형별)
            </h2>
            <SubTypeBarChart rows={rows} colorMap={SUB_TYPE_COLOR} />
          </section>

          <section className="card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              유형별 성과
            </h2>
            <table className="data">
              <thead>
                <tr>
                  <th>유형</th>
                  <th style={{ textAlign: 'right' }}>발송</th>
                  <th style={{ textAlign: 'right' }}>성공</th>
                  <th style={{ textAlign: 'right' }}>실패</th>
                  <th style={{ textAlign: 'right' }}>비용</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(new Set(rows.map((r) => r.sub_type))).map((st) => {
                  const subset = rows.filter((r) => r.sub_type === st)
                  const sent = subset.reduce((a, r) => a + r.sent, 0)
                  const successed = subset.reduce((a, r) => a + r.successed, 0)
                  const failed = subset.reduce((a, r) => a + r.failed, 0)
                  const cost = subset.reduce((a, r) => a + r.cost_krw, 0)
                  return (
                    <tr key={st}>
                      <td><span className="pill">{SUB_TYPE_LABEL[st] ?? st.toUpperCase()}</span></td>
                      <td style={{ textAlign: 'right' }}>{fmt(sent)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(successed)}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(failed)}</td>
                      <td style={{ textAlign: 'right' }}>₩{fmt(cost)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="card">
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          카카오 비즈 연결 가이드
        </h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 14 }}>
          카카오는 직접 API를 제공하지 않고 인증 발송대행사(SOL, 비즈뿌리오 등)를 통해야 합니다. 이미 SOL API가 연결돼 있으므로 <b>추가 API 키 발급은 불필요</b>하고, 아래 5단계만 완료하면 됩니다.
        </p>
        <ol className="step-list">
          <li>
            <div>
              <h4>카카오 비즈니스 채널 개설</h4>
              <p>
                <a href="https://business.kakao.com" target="_blank" rel="noreferrer" style={{ color: '#fbbf24' }}>business.kakao.com</a> 에서 사업자 인증 후 채널(옐로아이디) 개설. 채널 공개 설정 필수.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h4>SOL 콘솔에서 발신 프로필 등록</h4>
              <p>
                SOL 콘솔 → 카카오 → 채널 추가. 카카오 채널 관리자 인증번호를 입력해 채널을 SOL과 연결하고 <code>pfId</code>(발신프로필 ID)를 발급받음.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h4>알림톡 템플릿 등록 및 심사</h4>
              <p>
                SOL 콘솔 → 템플릿 관리에서 문구 작성 → 카카오 심사 신청. 승인까지 1~3 영업일 소요. 승인된 템플릿만 발송 가능. <code>templateId</code>가 발급됨.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h4>발송 테스트</h4>
              <p>
                SOL API <code>POST /messages/v4/send</code> 에 <code>type: ATA</code>, <code>pfId</code>, <code>templateId</code> 지정해서 본인 번호로 테스트 발송.
              </p>
            </div>
          </li>
          <li>
            <div>
              <h4>대시보드 자동 수집</h4>
              <p>
                발송이 시작되면 SOL <code>/messages/v4/statistics</code> 응답의 <code>total.ata</code> / <code>total.cta</code> / <code>total.cti</code> 필드에 카운트가 잡히고, 이 페이지에 자동 반영됩니다. 대시보드 쪽 추가 작업 없음.
              </p>
            </div>
          </li>
        </ol>
      </section>
    </main>
  )
}
