-- Marketing SaaS initial schema
-- 채널 공통: channel_accounts → campaigns → daily_metrics / message_logs
-- 운영: profiles, sync_runs

-- =============================================================================
-- Extensions
-- =============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- Enums
-- =============================================================================
create type channel_kind as enum (
  'sms_solapi',
  'kakao_biz',
  'google_ads',
  'meta_ads'
);

create type sync_status as enum (
  'running',
  'success',
  'partial',
  'failed'
);

create type user_role as enum (
  'admin',
  'viewer'
);

-- =============================================================================
-- profiles (Supabase auth.users 와 1:1)
-- =============================================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  role         user_role not null default 'viewer',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);

-- =============================================================================
-- channel_accounts
-- 한 채널당 여러 계정(광고 계정 / SOLAPI 서브계정 등)
-- secret_ref: Supabase Vault 의 secret name. 평문 금지.
-- =============================================================================
create table public.channel_accounts (
  id              uuid primary key default uuid_generate_v4(),
  channel         channel_kind not null,
  external_id     text not null,                -- 플랫폼의 accountId
  display_name    text not null,
  secret_ref      text,                          -- vault.secrets.name
  config          jsonb not null default '{}',   -- 채널별 추가 설정 (MCC ID, PFID 등)
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (channel, external_id)
);

create index idx_channel_accounts_channel on public.channel_accounts(channel) where is_active;

-- =============================================================================
-- campaigns
-- 광고는 실제 캠페인 매핑. SMS/카카오는 (account, message_type) 단위 합성 캠페인.
-- 예) channel=sms_solapi, external_id='synthetic:lms', name='SMS LMS'
-- =============================================================================
create table public.campaigns (
  id              uuid primary key default uuid_generate_v4(),
  account_id      uuid not null references public.channel_accounts(id) on delete cascade,
  channel         channel_kind not null,
  external_id     text not null,                -- 광고: 캠페인 ID / SMS: 'synthetic:<type>'
  name            text not null,
  message_type    text,                          -- sms/lms/mms/ata/cta 등. 광고는 null.
  status          text,                          -- 플랫폼 원본 상태 문자열
  raw             jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (account_id, external_id)
);

create index idx_campaigns_account on public.campaigns(account_id);
create index idx_campaigns_channel on public.campaigns(channel);

-- =============================================================================
-- daily_metrics
-- 공통 일자 × 캠페인 단위 집계. 광고 7일 rolling upsert / SMS 당일~전일 upsert.
-- cost_krw: KRW 정수 (소수점 버림). SMS는 statistics.balance 를 sent_count 비율 배분.
-- raw: 채널별 원본 페이로드 보관 → 재계산·신규 지표 추가 시 재수집 불필요.
-- =============================================================================
create table public.daily_metrics (
  id              uuid primary key default uuid_generate_v4(),
  date            date not null,                 -- KST 기준
  campaign_id     uuid not null references public.campaigns(id) on delete cascade,
  channel         channel_kind not null,

  -- 공통 지표 (채널에 따라 null 허용)
  impressions     bigint,                        -- 광고 노출 / SMS: 발송 시도 수
  clicks          bigint,                        -- 광고 클릭
  conversions     numeric,                       -- 전환 (fractional 가능)
  cost_krw        bigint not null default 0,

  -- 메시징 전용
  sent_count      bigint,                        -- SOLAPI total[type]
  success_count   bigint,                        -- SOLAPI successed[type]
  failed_count    bigint,                        -- SOLAPI failed[type]

  raw             jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (date, campaign_id)
);

create index idx_daily_metrics_date       on public.daily_metrics(date desc);
create index idx_daily_metrics_channel    on public.daily_metrics(channel, date desc);
create index idx_daily_metrics_campaign   on public.daily_metrics(campaign_id, date desc);

-- =============================================================================
-- message_logs
-- SOLAPI/카카오 건별 로그. recipient 는 해시만 저장 (원본 보관 금지).
-- =============================================================================
create table public.message_logs (
  id                uuid primary key default uuid_generate_v4(),
  account_id        uuid not null references public.channel_accounts(id) on delete cascade,
  channel           channel_kind not null,
  external_id       text not null,               -- messageId
  group_id          text,
  message_type      text not null,               -- sms/lms/ata/...
  status            text not null,
  status_code       text,
  recipient_hash    text not null,               -- sha256(recipient)
  sender            text,
  cost_krw          bigint,
  sent_at           timestamptz,
  date_created      timestamptz not null,
  date_updated      timestamptz,
  raw               jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  unique (account_id, external_id)
);

create index idx_message_logs_account_date on public.message_logs(account_id, date_created desc);
create index idx_message_logs_status       on public.message_logs(status);

-- =============================================================================
-- sync_runs
-- 수집 파이프라인 실행 이력. 채널·계정별로 기록. 실패는 error 에.
-- =============================================================================
create table public.sync_runs (
  id            uuid primary key default uuid_generate_v4(),
  channel       channel_kind not null,
  account_id    uuid references public.channel_accounts(id) on delete set null,
  status        sync_status not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  rows_upserted integer,
  date_from     date,
  date_to       date,
  error         text,
  meta          jsonb not null default '{}'
);

create index idx_sync_runs_channel_started on public.sync_runs(channel, started_at desc);
create index idx_sync_runs_status          on public.sync_runs(status) where status in ('failed', 'partial');

-- =============================================================================
-- updated_at 자동 갱신
-- =============================================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger trg_channel_accounts_updated
  before update on public.channel_accounts
  for each row execute function public.touch_updated_at();

create trigger trg_campaigns_updated
  before update on public.campaigns
  for each row execute function public.touch_updated_at();

create trigger trg_daily_metrics_updated
  before update on public.daily_metrics
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- auth.users → profiles 자동 생성
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- RLS
-- 원칙: 로그인 유저 읽기, 쓰기는 service_role 전용.
-- profiles 는 본인만 CRUD.
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.channel_accounts  enable row level security;
alter table public.campaigns         enable row level security;
alter table public.daily_metrics     enable row level security;
alter table public.message_logs      enable row level security;
alter table public.sync_runs         enable row level security;

-- profiles: 본인만
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id);
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- channel_accounts: 인증 유저 읽기
create policy channel_accounts_read on public.channel_accounts
  for select using (auth.role() = 'authenticated');

-- campaigns: 인증 유저 읽기
create policy campaigns_read on public.campaigns
  for select using (auth.role() = 'authenticated');

-- daily_metrics: 인증 유저 읽기
create policy daily_metrics_read on public.daily_metrics
  for select using (auth.role() = 'authenticated');

-- message_logs: admin 만 (PII 성격)
create policy message_logs_admin_read on public.message_logs
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- sync_runs: 인증 유저 읽기
create policy sync_runs_read on public.sync_runs
  for select using (auth.role() = 'authenticated');

-- 쓰기 정책 없음 → service_role 만 bypass 로 write.
