export const dynamic = 'force-static'

type Benchmark = {
  channel: string
  channelEmoji: string
  metric: string
  value: string
  description: string
  sourceLabel: string
  sourceUrl?: string
  methodology: string
  appliedIn: string
  notes?: string
}

const BENCHMARKS: Benchmark[] = [
  {
    channel: 'Google Ads',
    channelEmoji: '🔍',
    metric: 'CTR (클릭률)',
    value: '3.5%',
    description: '검색 광고에서 노출 대비 클릭이 발생하는 비율. 광고 카피 · 키워드 · 검색 의도 적합도가 모두 영향을 미침.',
    sourceLabel: 'WordStream — 2023 Google Ads Industry Benchmarks',
    sourceUrl: 'https://www.wordstream.com/blog/ws/2023/02/14/search-advertising-benchmarks',
    methodology: '북미 17개 산업 평균 ~3.17%, 전 산업 가중 평균 ~3.5%로 라운딩하여 사용.',
    appliedIn: 'Google Ads 페이지의 캠페인별 평가 · Overview 채널 카드(Google Ads 등급 산정).',
    notes: '한국 시장 별도 통계가 부족해 글로벌 평균 사용. 향후 한국 한정 데이터 확보 시 갱신.',
  },
  {
    channel: 'Meta Ads',
    channelEmoji: '📘',
    metric: 'CTR (클릭률)',
    value: '1.2%',
    description: 'Facebook · Instagram Feed 광고의 노출 대비 클릭률. Reels/Story 등 placement에 따라 평균이 다름.',
    sourceLabel: 'Meta Business — Advertising on Facebook 공식 가이드 (한국 Feed)',
    sourceUrl: 'https://www.facebook.com/business/help',
    methodology: 'Meta Business 공식 자료 + 한국 광고 대행사 공개 자료의 한국 Feed 평균을 기준치로 사용.',
    appliedIn: 'Meta Ads 페이지 캠페인별 평가 · Overview Meta 카드.',
    notes: 'Reels는 평균 1.5–2%, Story는 0.7~1% 수준으로 분리 통계가 필요할 경우 별도 추가 가능.',
  },
  {
    channel: 'Meta Ads',
    channelEmoji: '📘',
    metric: 'CPM (1000회 노출당 비용)',
    value: '₩7,000',
    description: '1,000회 노출에 드는 비용. 오디언스 사이즈 · 입찰 경쟁 정도가 가장 큰 변수.',
    sourceLabel: 'Meta Business 한국 광고주 평균 + 국내 대행사 리포트',
    methodology: '한국 Feed 캠페인 평균 CPM 6,000~8,000원 범위에서 중앙값 7,000원 사용.',
    appliedIn: 'Meta Ads 페이지의 CPM 평가 · Overview Meta 카드(CTR과 함께 worse-of 비교).',
    notes: 'CPM은 낮을수록 좋음 — 어댑터에서 `higherIsBetter=false` 처리.',
  },
  {
    channel: '문자 (문자하랑 SMS)',
    channelEmoji: '💬',
    metric: '발송 성공률',
    value: '98%',
    description: 'SMS · LMS · MMS 발송 시 통신사로 정상 도달한 비율. 수신 거부 · 무효 번호 · 발신번호 인증 상태 등에 영향.',
    sourceLabel: 'SOLAPI 운영 정상 기준',
    sourceUrl: 'https://developers.solapi.com/references/',
    methodology: 'SOLAPI 가이드의 정상 발송 기준치(98% 이상)를 채택.',
    appliedIn: '문자 페이지(/messaging/sms) · Overview 문자 카드.',
    notes: '실패율 5% 초과 시 번호 DB 클렌징 또는 발신번호 인증 상태 점검 권장.',
  },
  {
    channel: '카카오톡 (문자하랑 알림톡)',
    channelEmoji: '💛',
    metric: '전달률',
    value: '99%',
    description: '알림톡 · 친구톡이 카카오 사용자에게 정상 전달된 비율. 채널 친구 맺기 상태 · 템플릿 승인 상태가 핵심 변수.',
    sourceLabel: 'SOLAPI 알림톡 운영 정상 기준',
    sourceUrl: 'https://developers.solapi.com/references/',
    methodology: '카카오 알림톡은 통신사 중계가 아닌 카카오 인프라 직접 전송이라 SMS보다 1%p 높은 99% 기준.',
    appliedIn: '카카오톡 페이지(/messaging/kakao) · Overview 카카오 카드.',
    notes: '전달률 95% 미만이면 발신 프로필 또는 템플릿 재심사 필요성 검토.',
  },
]

const GRADE_THRESHOLDS = [
  { label: '매우 우수 (excellent)', condition: '평균 대비 +50% 이상', color: '#16a34a' },
  { label: '양호 (good)', condition: '평균 대비 +15% ~ +50%', color: '#86efac' },
  { label: '평균 (average)', condition: '평균 ±15% 이내', color: '#eab308' },
  { label: '미흡 (below)', condition: '평균 대비 -15% ~ -40%', color: '#fb923c' },
  { label: '개선 필요 (poor)', condition: '평균 대비 -40% 이하', color: '#ef4444' },
]

export default function BenchmarksPage() {
  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">평가 기준 · 업계 평균</h1>
        <p className="page-subtitle">
          대시보드의 모든 등급(매우 우수 / 양호 / 평균 / 미흡 / 개선 필요)은 아래 5개 지표의 업계 평균과 비교해 산정합니다.
        </p>
      </header>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          요약 — 5개 핵심 기준
        </h2>
        <table className="data" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>채널</th>
              <th>지표</th>
              <th style={{ textAlign: 'right' }}>업계 평균</th>
              <th>출처</th>
            </tr>
          </thead>
          <tbody>
            {BENCHMARKS.map((b, i) => (
              <tr key={i}>
                <td>
                  <span style={{ marginRight: 6 }}>{b.channelEmoji}</span>
                  {b.channel}
                </td>
                <td>{b.metric}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{b.value}</td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{b.sourceLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        지표별 상세
      </h2>
      <section className="grid grid-2" style={{ marginBottom: 20 }}>
        {BENCHMARKS.map((b, i) => (
          <div key={i} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>{b.channelEmoji}</span>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{b.channel}</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{b.metric}</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
                {b.value}
              </div>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, margin: '0 0 12px' }}>{b.description}</p>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ marginBottom: 6 }}>
                <b style={{ color: 'var(--text)' }}>출처</b>{' '}
                {b.sourceUrl ? (
                  <a href={b.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>
                    {b.sourceLabel}
                  </a>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>{b.sourceLabel}</span>
                )}
              </div>
              <div style={{ marginBottom: 6, color: 'var(--muted)' }}>
                <b style={{ color: 'var(--text)' }}>산출 근거</b> {b.methodology}
              </div>
              <div style={{ marginBottom: b.notes ? 6 : 0, color: 'var(--muted)' }}>
                <b style={{ color: 'var(--text)' }}>적용 위치</b> {b.appliedIn}
              </div>
              {b.notes && (
                <div style={{ color: 'var(--muted)' }}>
                  <b style={{ color: 'var(--text)' }}>참고</b> {b.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </section>

      <h2 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        등급 분류 기준
      </h2>
      <section className="card" style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, margin: '0 0 12px', color: 'var(--muted)' }}>
          현재 값과 업계 평균의 비율(ratio)을 계산해 5단계로 분류합니다. 비율 = 현재 / 평균 (지표가 낮을수록 좋은 경우 역수). 코드: <code style={{ background: 'var(--panel-2)', padding: '1px 6px', borderRadius: 4 }}>lib/benchmarks.ts</code> · <code style={{ background: 'var(--panel-2)', padding: '1px 6px', borderRadius: 4 }}>gradeFromRatio()</code>
        </p>
        <table className="data" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>등급</th>
              <th>조건</th>
              <th style={{ textAlign: 'center' }}>색상</th>
            </tr>
          </thead>
          <tbody>
            {GRADE_THRESHOLDS.map((g) => (
              <tr key={g.label}>
                <td><b>{g.label}</b></td>
                <td style={{ color: 'var(--muted)' }}>{g.condition}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block',
                    width: 22, height: 22, borderRadius: 999,
                    background: g.color, border: '1px solid var(--border)',
                  }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          갱신 정책
        </h2>
        <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 13, lineHeight: 1.7 }}>
          <li>월 1회 수기 검토 — 광고 매체사 공식 보고서 / 대행사 산업 평균 자료를 비교해 변경 여부 판단.</li>
          <li>한국 시장에 특화된 공개 통계가 추가로 확보되면 우선 반영.</li>
          <li>변경 시 코드 한 곳만 수정 — <code style={{ background: 'var(--panel-2)', padding: '1px 6px', borderRadius: 4 }}>lib/benchmarks.ts</code>의 <code style={{ background: 'var(--panel-2)', padding: '1px 6px', borderRadius: 4 }}>KR_BENCHMARKS</code> 상수.</li>
          <li>기준이 바뀌면 대시보드 전 페이지(Overview · 광고 · 메시지)에 즉시 반영됨 — 별도 캐시 무효화 불필요.</li>
        </ul>
      </section>
    </main>
  )
}
