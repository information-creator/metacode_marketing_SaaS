export type BenchmarkGrade = 'excellent' | 'good' | 'average' | 'below' | 'poor'

export type Benchmark = {
  label: string
  value: number
  format: (v: number) => string
  avg: number          // 한국 업계 평균
  higherIsBetter: boolean
  note: string
}

const KR_BENCHMARKS = {
  google_ctr: 3.5,       // %, 검색 광고 평균
  meta_ctr: 1.2,         // %, Facebook/Instagram feed 평균
  meta_cpm_krw: 7000,    // ₩, Korea feed 평균
  sms_success_rate: 98,  // %, 정상 발송 기준
  kakao_success_rate: 99, // %, 알림톡 전달률 기준
}

export function gradeFromRatio(ratioVsAvg: number, higherIsBetter: boolean): BenchmarkGrade {
  const r = higherIsBetter ? ratioVsAvg : 1 / ratioVsAvg
  if (r >= 1.5) return 'excellent'
  if (r >= 1.15) return 'good'
  if (r >= 0.85) return 'average'
  if (r >= 0.6) return 'below'
  return 'poor'
}

export function gradeLabel(g: BenchmarkGrade): string {
  return ({ excellent: '매우 우수', good: '양호', average: '평균', below: '미흡', poor: '개선 필요' } as const)[g]
}

export function gradeColor(g: BenchmarkGrade): string {
  return ({ excellent: '#22c55e', good: '#86efac', average: '#fbbf24', below: '#fb923c', poor: '#ef4444' } as const)[g]
}

export function googleCtrBenchmark(ctr_pct: number): Benchmark {
  return {
    label: 'Google CTR',
    value: ctr_pct,
    format: (v) => `${v.toFixed(2)}%`,
    avg: KR_BENCHMARKS.google_ctr,
    higherIsBetter: true,
    note: '한국 검색 광고 평균 3.5%',
  }
}

export function metaCtrBenchmark(ctr_pct: number): Benchmark {
  return {
    label: 'Meta CTR',
    value: ctr_pct,
    format: (v) => `${v.toFixed(2)}%`,
    avg: KR_BENCHMARKS.meta_ctr,
    higherIsBetter: true,
    note: '한국 Feed 평균 1.2%',
  }
}

export function metaCpmBenchmark(cpm_krw: number): Benchmark {
  return {
    label: 'Meta CPM',
    value: cpm_krw,
    format: (v) => `₩${Math.round(v).toLocaleString('ko-KR')}`,
    avg: KR_BENCHMARKS.meta_cpm_krw,
    higherIsBetter: false,
    note: '한국 Feed 평균 ₩7,000',
  }
}

export function smsSuccessBenchmark(success_pct: number): Benchmark {
  return {
    label: '문자 성공률',
    value: success_pct,
    format: (v) => `${v.toFixed(1)}%`,
    avg: KR_BENCHMARKS.sms_success_rate,
    higherIsBetter: true,
    note: '정상 발송 기준 98%+',
  }
}

export function kakaoSuccessBenchmark(success_pct: number): Benchmark {
  return {
    label: '카카오톡 전달률',
    value: success_pct,
    format: (v) => `${v.toFixed(1)}%`,
    avg: KR_BENCHMARKS.kakao_success_rate,
    higherIsBetter: true,
    note: '알림톡 전달률 기준 99%+',
  }
}
