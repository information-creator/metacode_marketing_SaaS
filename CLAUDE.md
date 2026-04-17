# CLAUDE.md

이 저장소에서 작업할 때 Claude Code를 위한 가이드입니다.
제품 요구사항 상세는 `PRD.md` 참조.

## 프로젝트 한 줄 요약

문자하랑(SOL) · 카카오 비즈 · Google Ads · Meta Ads 성과를 한 대시보드에서 보는 내부 팀·경영진용 통합 마케팅 대시보드. Next.js + Supabase + Vercel Cron 기반.

## 기술 스택

- **프론트 / 배포**: Next.js (App Router) + Vercel
- **언어**: TypeScript (strict)
- **DB / 인증 / 시크릿**: Supabase (Postgres + Auth + Vault)
- **수집 스케줄러**: Vercel Cron (1차) / GitHub Actions (필요시)
- **차트**: Recharts 또는 Tremor (확정 필요)

## 디렉토리 구조 (목표 형태)

```
marketing_saas/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx              Overview
│   │   ├── channels/page.tsx     Channel Compare
│   │   ├── ads/page.tsx          Google/Meta 상세
│   │   ├── messaging/page.tsx    SMS/카카오 상세
│   │   └── sync/page.tsx         Sync Status
│   ├── (auth)/                   로그인 / 콜백
│   ├── (admin)/settings/         채널 계정 등록, API 키 입력
│   └── api/
│       ├── metrics/              집계 조회 엔드포인트
│       ├── sync/[channel]/       수동 재수집 트리거
│       └── cron/[channel]/       Vercel Cron 호출용
├── lib/
│   ├── channels/
│   │   ├── types.ts              ChannelAdapter 인터페이스
│   │   ├── sms-solapi/adapter.ts
│   │   ├── kakao-biz/adapter.ts
│   │   ├── google-ads/adapter.ts
│   │   └── meta-ads/adapter.ts
│   ├── supabase/                 client / server / service
│   ├── normalize/                채널별 → 공통 스키마 변환
│   └── metrics/                  집계 쿼리 빌더
├── supabase/
│   └── migrations/               DB 스키마
├── types/database.ts             supabase gen types 산출물
└── vercel.json                   cron 스케줄
```

## 핵심 아키텍처 원칙

1. **모든 지표는 우리 DB에 정규화 저장한다.** 대시보드 요청은 절대 플랫폼 API를 직접 치지 않는다. 외부 API는 오직 수집 어댑터에서만.

2. **수집은 어댑터 패턴으로.** 새 채널 추가 = 어댑터 파일 하나 + `channel_accounts` 레코드 한 개. 파이프라인 본체는 건드리지 않는다.

3. **원본 raw 페이로드는 `daily_metrics.raw` (jsonb)에 보관.** 스키마 바뀌거나 새 지표 추가할 때 재수집 없이 DB에서 재계산 가능.

4. **광고는 7일 rolling window로 덮어쓴다.** 플랫폼이 전환/비용을 후행 보정하기 때문. upsert 키는 `(date, campaign_id)`.

5. **수집 실패 격리.** 한 채널·한 계정 실패가 전체 파이프라인을 멈추지 않게 try/catch 격리, `sync_runs.error`에 기록.

6. **API 키는 Supabase Vault로.** 평문 저장 금지. 어댑터는 vault ref로 받아 런타임에 복호화.

7. **대시보드는 읽기 전용.** 플랫폼에 write-back 하지 않음. 캠페인 생성/수정은 각 플랫폼 콘솔에서.

## RLS 원칙

- `daily_metrics`, `campaigns`, `channel_accounts`: 로그인 유저 읽기 가능, 쓰기는 service_role만
- `profiles`: 본인만 CRUD
- `sync_runs`: 로그인 유저 읽기, 쓰기 service_role만
- 수집 크론은 반드시 **service_role 키**로 접속

## Supabase 클라이언트 사용 규칙

- **브라우저 코드**: `lib/supabase/client.ts` (anon key)
- **서버 컴포넌트 / Route Handler**: `lib/supabase/server.ts` (anon + 쿠키)
- **수집 / 크론 / 관리자 백엔드 작업**: `lib/supabase/service.ts` (service_role)

용도를 혼동하면 RLS 우회되거나 인증이 풀림. 용도에 맞는 걸 고를 것.

## 어댑터 인터페이스

```ts
// lib/channels/types.ts
export interface ChannelAdapter {
  channel: 'sms_solapi' | 'kakao_biz' | 'google_ads' | 'meta_ads'
  listCampaigns(account: ChannelAccount): Promise<NormalizedCampaign[]>
  fetchDailyMetrics(account: ChannelAccount, range: DateRange): Promise<NormalizedDailyMetric[]>
  fetchMessageLogs?(account: ChannelAccount, range: DateRange): Promise<NormalizedMessageLog[]>
}
```

모든 어댑터는 이 인터페이스만 구현하면 파이프라인 본체·대시보드 집계 쿼리는 건드릴 필요 없음.

## 코딩 컨벤션

- **타입**: `supabase gen types`를 `types/database.ts`로 생성. DB 타입 수작업 금지
- **ID**: UUID
- **시간**: DB는 `timestamptz`, 집계 키 `date`는 KST 기준
- **통화**: `cost_krw` 컬럼에 KRW 정수로 저장 (소수점 버림)
- **에러 핸들링**: 어댑터 실패는 해당 채널만 격리 fail, `sync_runs.error`에 기록

## 개발 명령어 (확정되면 업데이트)

```bash
# 개발 서버
npm run dev

# 수동 수집 (로컬)
npm run sync -- --channel google_ads --days 7

# Supabase 타입 재생성
npm run gen:types

# 마이그레이션 적용 (로컬 Supabase)
npx supabase db reset
```

## 수집 관련 주의사항

- **Rate limit**: Google Ads/Meta Graph 모두 제한 있음. 계정별 순차 호출, 필요시 지수 백오프
- **Google Ads**: v17+ gRPC 또는 REST. Developer Token 승인 필수
- **Meta Ads**: Graph API + Marketing API 권한. 토큰 갱신 주기 체크
- **SOL API**: 문자하랑 공식 문서 기준. 발송 통계 엔드포인트 확인 필요
- **카카오 비즈**: 알림톡/친구톡 등 유형별 API 다름. 세부 채널 유형 확정 후 어댑터 설계

## 보안

- `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 포함, 절대 커밋 금지
- 채널 API 키는 DB 평문 저장 금지 — Supabase Vault 사용
- `message_logs.recipient`는 해시 저장 (원본 번호 보관 X)

## 참고 문서

- `PRD.md` — 제품 요구사항, 기능 범위, 오픈 이슈
- `supabase/migrations/` — DB 스키마 (작성 예정)

## 현재 상태

초기 설계 단계. 아직 코드 없음. 다음 작업:
1. PRD 오픈 이슈 확정 (카카오 세부 유형, 멀티 계정, 전환 기준)
2. Supabase 프로젝트 생성 + 초기 마이그레이션 작성
3. 채널 어댑터 인터페이스 정의 + Google Ads PoC
