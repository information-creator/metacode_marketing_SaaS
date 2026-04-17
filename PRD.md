# Marketing SaaS — Product Requirements Document

## 1. 제품 개요

Metacode의 마케팅 성과를 한 화면에서 보는 **통합 마케팅 대시보드 (Metacode Marketing)**.
팀/경영진이 채널별 성과를 채널마다 콘솔을 들어가지 않고 한 곳에서 비교·보고·리포트까지 해결한다. Overview에서는 업계 평균 대비 "지금 잘하고 있는지"를 한눈에 판단 가능.

### 핵심 가치 제안
- **한 곳에서 비교** — SMS·카카오·광고 성과를 공통 지표로 정규화해 한 번에 비교
- **주기적 자동 수집** — 각 플랫폼 API에서 주기적으로 수집, 최신 데이터가 대시보드에 반영
- **경영진용 요약** — 기간 비교, 채널 믹스, ROAS/CPA 중심의 KPI 카드
- **운영 투명성** — 수집 실패/지연을 숨기지 않고 Sync Status 페이지에 노출

## 2. 타겟 유저

- **1차**: 내부 마케팅 운영자 — 캠페인 성과를 매일 확인
- **2차**: 경영진 — 주/월 단위 요약 리포트 열람
- (외부 고객용 SaaS 아님 — 멀티테넌트는 현재 범위 외)

## 3. MVP 기능 범위

### 3.1 연동 채널
1. **문자하랑 (SOL API)** — SMS/LMS/MMS 발송 로그 및 비용
2. **카카오톡 비즈 채널** — 알림톡/친구톡/상담톡 (세부 유형은 추후 확정)
3. **Google Ads** — 노출·클릭·비용·전환
4. **Meta Ads** — 도달·노출·클릭·비용·전환

### 3.2 대시보드 화면

| 페이지 | 내용 |
|---|---|
| **Overview** | 기간 선택, 채널별 비용/노출/클릭/전환 KPI 카드, 전기간 대비 증감, 채널 믹스 도넛 |
| **Channel Compare** | 채널별 CPC/CPA/CTR 테이블 + 시계열 라인 차트 |
| **Ads (Google/Meta)** | 캠페인 테이블, ROAS 상위/하위, 소재 단위 드릴다운 |
| **Messaging (SMS/카카오)** | 발송량·도달률·클릭률 추이, 템플릿별 성과, 실패 코드 분포 |
| **Sync Status** | 각 채널 최종 수집 시각, 실패 로그, 수동 재수집 버튼 |
| **Settings** | 채널 계정 등록/비활성화, API 키 입력 (Vault 저장) |

### 3.3 권한
- **admin** — 채널 계정/키 등록, 재수집 실행
- **viewer** — 대시보드 조회만 (경영진)

## 4. 데이터 수집 전략

### 공통 정규화
채널마다 지표 이름이 다르므로 `daily_metrics` 테이블에 공통 축으로 정규화 후 저장.

| 공통 지표 | 문자하랑 | 카카오 비즈 | Google Ads | Meta Ads |
|---|---|---|---|---|
| sent | 발송 | 발송 | impressions | impressions |
| delivered | 수신 성공 | 도달 | — | — |
| clicked | 단축URL 클릭 | 버튼 클릭 | clicks | clicks |
| cost_krw | 건당 비용 합 | 건당 비용 합 | cost_micros/1e6 | spend |
| conversions | (선택) | (선택) | conversions | actions |

### 수집 주기
- 광고(Google/Meta): 3시간 간격, 최근 **7일 rolling window**로 덮어쓰기 (플랫폼 지연 데이터 보정)
- SMS/카카오: 30분 간격 폴링 + 가능하면 웹훅
- 수동 재수집: 관리자가 기간 지정해 트리거 가능

### 실패 격리
- 한 채널 수집 실패가 다른 채널/대시보드에 영향 주지 않음
- `sync_runs.error`에 기록, Sync Status에서 가시화

## 5. 주요 플로우

### 5.1 수집 플로우
```
Vercel Cron / pg_cron (3h 간격)
  ↓
활성 channel_accounts 로드
  ↓
for each account: 어댑터 fetchDailyMetrics(range) → 정규화 → upsert(daily_metrics)
  ↓
sync_runs 에 성공/실패 기록
```

### 5.2 대시보드 조회 플로우
```
유저가 기간 선택 → /api/metrics?range=... 호출
  ↓
Postgres 집계 쿼리 (channel, campaign 단위)
  ↓
React 차트 컴포넌트에서 렌더
```

### 5.3 리포트 내보내기 (Phase 2)
주간/월간 요약을 PDF 또는 공유 링크로 내보내기.

## 6. 기술 스택

| 영역 | 선택 |
|---|---|
| 프론트 / 배포 | Next.js (App Router) + Vercel |
| DB | Supabase Postgres |
| 인증 | Supabase Auth (이메일 + role 기반) |
| 시크릿 | Supabase Vault (채널 API 키) |
| 수집 스케줄러 | Vercel Cron (1차) / 필요시 GitHub Actions |
| 차트 | Recharts 또는 Tremor |
| 언어 | TypeScript (strict) |

## 7. 데이터 모델 (개요)

주요 엔티티:
- `channel_accounts` — 채널별 계정과 자격증명 Vault 참조
- `campaigns` — 광고 캠페인/메시지 템플릿 상위 단위
- `daily_metrics` — 일 단위 정규화 지표 (대시보드의 집계 원천)
- `message_logs` — SMS/카카오 단건 로그 (선택, 발송 실패 분석용)
- `sync_runs` — 수집 실행 기록
- `profiles` — 유저 (auth.users 확장 + role)

상세 스키마는 `supabase/migrations/` 참조 (작성 예정).

## 8. 비기능 요구사항

- **성능**: 대시보드 초기 로드 P95 < 1.5s (최근 30일 기준)
- **수집 지연**: 광고 최대 3시간, 메시징 최대 30분
- **시간대**: DB는 `timestamptz`, 집계 키 `date`는 KST 기준으로 맞춤
- **통화**: KRW 기본
- **관측**: 수집 실패 시 Sync Status 페이지 + 슬랙 웹훅(Phase 2)

## 9. 범위 외 (Out of Scope)

- 멀티테넌트 / 외부 고객 로그인
- 캠페인 생성/수정 (조회 전용, write-back 없음)
- 자체 어트리뷰션 모델 (각 플랫폼 전환값 그대로 사용)
- 모바일 앱
- 실시간 스트리밍

## 10. 성공 지표

- **데이터 완전성**: 채널별 최근 24시간 수집 성공률 > 99%
- **사용**: 주간 활성 이용자 (팀원 수 대비 비율)
- **의사결정 반영**: 대시보드 기반 예산 재배분 건수 (정성 지표)

## 11. 로드맵

| Phase | 내용 | 기간 |
|---|---|---|
| Phase 1 — 뼈대 | Supabase 스키마 + Auth + 채널 등록 UI + Sync Status | ~1주 |
| Phase 2 — 광고 | Google/Meta 어댑터 + Overview + Ads 페이지 | ~1주 |
| Phase 3 — 메시징 | SOL/카카오 어댑터 + Messaging 페이지 | ~1주 |
| Phase 4 — 리포트 | 기간 비교, PDF 내보내기, 슬랙 알림 | 1~2주 |

## 12. 오픈 이슈 — 결정 이력

| 이슈 | 결정 | 날짜 |
|---|---|---|
| 카카오 비즈 채널 세부 유형 | SOL 어댑터가 ata/cta/cti/bms_* 전부 커버. 별도 어댑터 불필요 | 2026-04-17 |
| 멀티 계정 (Google Ads MCC) | MCC 1개 + 하위 1계정(2242068833). 단일 계정 구조로 시작, 나중에 확장 | 2026-04-17 |
| 전환 단일 진실원 | **플랫폼 자체 전환값 그대로 사용** (a). GA4 통일은 Phase 2+ | 2026-04-17 |
| 메시지 단건 로그 보관 | **집계만 저장** (a). message_logs 테이블 생성 안 함. 단건 조사 필요시 SOL 콘솔 직접 | 2026-04-17 |
| SOL 일일 통계 엔드포인트 | `/messages/v4/statistics` 존재 확인. monthPeriod.dayPeriod.total.{sub_type} 구조 | 2026-04-17 |

## 13. 채널 연결 현황 (실시간 API 호출 단계)

| 채널 | 어댑터 | 상태 | 인증 |
|---|---|---|---|
| SOL (문자하랑) | `lib/channels/sol/adapter.ts` | ✅ 연결 | API Key + HMAC-SHA256 |
| Google Ads | `lib/channels/google-ads/adapter.ts` | ✅ 연결 (API v20) | Developer Token + OAuth2 Refresh Token |
| Meta Ads | `lib/channels/meta-ads/adapter.ts` | ✅ 연결 (Graph API v21.0) | Long-lived Access Token (60일 주기 갱신) |
| 카카오 비즈 (독립 채널) | - | ⏸ 보류 | 볼륨 5% + SOL 일부 흡수로 우선순위 낮음 |

## 14. 업계 벤치마크 기준 (Overview 페이지 평가용)

한국 시장 평균 (`lib/benchmarks.ts`):
- Google 검색 CTR: 3.5%
- Meta Feed CTR: 1.2%
- Meta CPM: ₩7,000
- 문자 성공률: 98%

등급: excellent (1.5x+) / good (1.15x+) / average (±15%) / below (0.6x~) / poor (<0.6x)
