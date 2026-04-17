# TODO — Marketing SaaS

> 재시작 후에도 이어갈 수 있도록 작업 순서를 기록. 완료된 항목은 `[x]` 로 체크.

---

## 📌 지금 바로 할 일 (Next)

- [ ] **Claude Code 재시작** (`.claude/settings.json` deny 규칙 적용 위해)
  ```bash
  cd /home/pc/dev/metacode/marketing_saas
  claude
  ```
- [ ] 재시작 후 Claude가 `.env.local` Read 시도 → **차단 확인**
- [ ] 차단 확인되면 `.env.local` 에 SOLAPI 키 입력
  - `SOLAPI_API_KEY=`
  - `SOLAPI_API_SECRET=`
  - `SOLAPI_SENDER_EXAMPLE=01012345678`
  - `SOLAPI_KAKAO_PFID=` (알림톡 사용 시)

---

## Phase 0 — 기반 세팅 (진행 중)

- [x] PRD.md 작성
- [x] CLAUDE.md 작성
- [x] `.env.local.example` 템플릿
- [x] `.env.local` 빈 파일
- [x] `.gitignore`
- [x] `.claude/settings.json` — `.env*` Read deny 규칙
- [ ] Claude Code 재시작 후 deny 규칙 실동작 검증

---

## Phase 1 — SOLAPI PoC (재시작 후)

- [x] `scripts/solapi-poc.ts` 작성
  - HMAC 서명 인증 구현
  - `GET /messages/v4/list` 최근 7일 발송 내역 조회
  - `GET /messages/v4/statistics` 통계 조회
- [x] 사용자가 로컬에서 실행: `npx tsx scripts/solapi-poc.ts`
- [x] 응답 구조 확인 — list/statistics/balance 모두 동작 확인
- [x] 정규화 스키마 확정 — statistics.dayPeriod 를 daily_metrics 로, list 를 message_logs 로 매핑. cost_krw 는 일자 balance 를 sent_count 비율 배분
- [ ] ⚠️ PoC 에 사용한 SOLAPI 키 **폐기·재발급** (채팅 노출분)

---

## Phase 2 — 프로젝트 스캐폴딩

- [ ] Next.js (App Router) 초기화
- [ ] `package.json` — tsx, supabase-js, recharts/tremor 등 의존성
- [ ] `lib/supabase/` — client / server / service
- [ ] `lib/channels/types.ts` — ChannelAdapter 인터페이스
- [ ] Supabase 프로젝트 생성 + 연결 정보 `.env.local` 에 추가
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

---

## Phase 3 — Supabase 스키마

- [x] `supabase/migrations/0001_init.sql`
  - `channel_accounts`, `campaigns`, `daily_metrics`, `message_logs`, `sync_runs`, `profiles`
- [x] RLS 정책 — viewer 읽기, service_role 쓰기, message_logs 는 admin 한정
- [ ] Supabase 프로젝트 생성 + 마이그레이션 apply
- [ ] `npm run gen:types` → `types/database.ts`

---

## Phase 4 — SOLAPI 어댑터 통합

- [ ] `lib/channels/sms-solapi/adapter.ts` — PoC 코드 리팩터
- [ ] `lib/channels/sms-solapi/normalize.ts` — 응답 → `daily_metrics`
- [ ] `app/api/sync/sms_solapi/route.ts` — 수동 재수집
- [ ] `app/api/cron/sms_solapi/route.ts` — Vercel Cron 엔드포인트
- [ ] `vercel.json` — 30분 간격 크론 등록
- [ ] Sync Status 페이지에 SOLAPI 표시

---

## Phase 5 — 광고 어댑터 (Google/Meta)

- [ ] Google Ads API Developer Token 신청 (승인까지 시간 소요)
- [ ] Meta Marketing API 앱/토큰 발급
- [ ] `lib/channels/google-ads/adapter.ts`
- [ ] `lib/channels/meta-ads/adapter.ts`
- [ ] 광고는 7일 rolling window upsert
- [ ] Overview + Ads 페이지

---

## Phase 6 — 카카오 비즈 / Kakao 로그인

- [ ] 카카오 비즈 채널 유형 확정 (알림톡/친구톡/상담톡) — 현재 SOLAPI 경유 가능성 높음
  - 확정되면 SOLAPI 어댑터에 `message_type` 컬럼으로 통합 또는 별도 어댑터
- [ ] (검토) Kakao Developers 통계 API — 카카오 로그인 신규 가입자/DAU
  - 앱 ID: `714896` / 채널: `@metacodem`
  - 마케팅 지표로 가치 있으면 어댑터 추가

---

## Phase 7 — 대시보드 UI

- [ ] Overview — KPI 카드, 채널 믹스 도넛
- [ ] Channel Compare — CPC/CPA/CTR 테이블 + 시계열
- [ ] Messaging — SMS/카카오 템플릿별 성과
- [ ] Ads — 캠페인·소재 드릴다운
- [ ] Sync Status — 최종 수집 시각, 실패 로그
- [ ] Settings — 채널 계정 등록 UI

---

## Phase 8 — 리포트/알림 (선택)

- [ ] 기간 비교 (전주/전월 대비)
- [ ] PDF 내보내기 (Playwright 또는 react-pdf)
- [ ] 슬랙 웹훅 — 수집 실패 알림, 주간 요약

---

## 🔒 보안 체크리스트

- [x] `.env.local` 은 `.gitignore` 에 포함
- [x] Claude Read deny 규칙 (재시작 후 검증 필요)
- [ ] Supabase Vault 로 API 키 이관 (운영 단계)
- [ ] `chmod 600 .env.local` (선택, 더 강한 격리)
- [ ] `message_logs.recipient` 해시 저장
- [ ] Vercel 환경변수 세팅 시 production/preview 분리

---

## ❓ 확정 필요한 오픈 이슈

- [ ] **카카오 비즈** — 알림톡 / 친구톡 / 상담톡 중 어느 유형 사용?
- [ ] **Google Ads MCC** — 하위 다중 계정 지원 필요?
- [ ] **전환 단일 진실원** — 플랫폼 자체 값? GA4? 내부 이벤트?
- [ ] **메시지 단건 로그 보관 기간** — 개인정보 관점

---

## 📚 참고

- `PRD.md` — 제품 요구사항
- `CLAUDE.md` — 개발 가이드
- `~/.claude/projects/-home-pc-dev-metacode-marketing-saas/memory/` — Claude 기억
- SOLAPI 문서: https://developers.solapi.com
- Kakao Developers: https://developers.kakao.com (앱 ID 714896)
