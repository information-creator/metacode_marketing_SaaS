# 외부 채널 API 레퍼런스

각 채널 어댑터가 호출하는 외부 API와 응답 데이터 구조. 어댑터를 수정하거나 새 지표를 뽑을 때 이 문서를 먼저 본다.

---

## 1. SOLAPI (문자하랑 / 카카오 비즈)

- 어댑터: `lib/channels/sol/adapter.ts`
- API 호스트: `https://api.solapi.com`
- 공식 문서: https://developers.solapi.com/references/
- 환경 변수: `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`

### 인증
HMAC-SHA256 헤더 — 매 요청마다 서명 생성.

```
Authorization: HMAC-SHA256 apiKey={KEY}, date={ISO8601}, salt={hex32}, signature={HMAC(date+salt, SECRET)}
```

### 1-1. `GET /messages/v4/statistics`

일별 · 메시지 세부 타입별 발송 통계.

쿼리 파라미터

| 파라미터    | 타입   | 설명                       |
| ----------- | ------ | -------------------------- |
| `startDate` | string | `YYYY-MM-DD` (KST)         |
| `endDate`   | string | `YYYY-MM-DD` (KST), 포함   |

응답 JSON (예시)

```json
{
  "monthPeriod": [
    {
      "date": "2026/04",
      "dayPeriod": [
        {
          "date": "2026/04/15",
          "balance": 12450,
          "total": {
            "sms": 320,
            "lms": 18,
            "mms": 0,
            "ata": 1240,
            "cta": 56,
            "total": 1634
          },
          "successed": {
            "sms": 318,
            "lms": 18,
            "ata": 1235,
            "cta": 55
          }
        }
      ]
    }
  ]
}
```

응답 필드

| 필드                          | 타입            | 의미                                           |
| ----------------------------- | --------------- | ---------------------------------------------- |
| `monthPeriod[]`               | array           | 월 단위 묶음                                   |
| `monthPeriod[].date`          | string          | `YYYY/MM`                                      |
| `monthPeriod[].dayPeriod[]`   | array           | 일 단위 행                                     |
| `dayPeriod[].date`            | string          | `YYYY/MM/DD` (어댑터에서 `-`로 치환)           |
| `dayPeriod[].balance`         | number (KRW)    | 그날 차감된 캐시 합계                          |
| `dayPeriod[].total[subType]`  | number          | sub_type별 총 발송 건수 (`total` 키는 합계)    |
| `dayPeriod[].successed[subType]` | number       | sub_type별 성공 건수                           |

메시지 세부 타입 (`subType`)

| 그룹       | 값                                                                                 |
| ---------- | ---------------------------------------------------------------------------------- |
| SMS 계열   | `sms`, `lms`, `mms`                                                                |
| 카카오 계열 | `ata` (알림톡), `cta` (친구톡 텍스트), `cti` (친구톡 이미지), `bms_text`, `bms_image`, `bms_wide`, `bms_wide_item_list`, `bms_carousel_feed`, `bms_premium_video`, `bms_commerce`, `bms_carousel_commerce`, `bms_free` |

⚠️ **비용은 sub_type별로 안 옴.** 어댑터는 일별 `balance`를 그날 sub_type 발송량 비율로 안분 배분해서 `cost_krw`를 계산. 정확한 단가가 필요하면 사용 내역 API(별도)로 교체 검토.

### 1-2. `GET /cash/v1/balance`

캐시 잔액 조회 (대시보드 우상단 잔액 카드).

응답 JSON

```json
{
  "balance": 245300,
  "point": 1200,
  "deposit": 0,
  "autoRecharge": 100000,
  "minimumCash": 50000
}
```

응답 필드

| 필드            | 타입         | 의미                          |
| --------------- | ------------ | ----------------------------- |
| `balance`       | number (KRW) | 사용 가능한 캐시 잔액         |
| `point`         | number       | 적립 포인트                   |
| `deposit`       | number (KRW) | 예치금                        |
| `autoRecharge`  | number (KRW) | 자동 충전 금액                |
| `minimumCash`   | number (KRW) | 자동 충전이 트리거되는 최소치 |

---

## 2. Google Ads API

- 어댑터: `lib/channels/google-ads/adapter.ts`
- API 호스트: `https://googleads.googleapis.com`
- 사용 버전: `v20`
- 공식 문서
  - REST 개요: https://developers.google.com/google-ads/api/rest/overview
  - GAQL 필드: https://developers.google.com/google-ads/api/fields/v20/overview
- 환경 변수: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, (선택) `GOOGLE_ADS_LOGIN_CUSTOMER_ID`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`

### 인증
OAuth2 refresh token → access token 교환 후 매 요청에 부착.

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id={CLIENT_ID}
client_secret={CLIENT_SECRET}
refresh_token={REFRESH_TOKEN}
grant_type=refresh_token
```

응답

```json
{ "access_token": "ya29....", "expires_in": 3599, "token_type": "Bearer" }
```

이후 모든 요청 헤더

```
Authorization: Bearer {access_token}
developer-token: {GOOGLE_ADS_DEVELOPER_TOKEN}
login-customer-id: {MCC_ID}            # MCC를 통할 때만
Content-Type: application/json
```

### 2-1. `POST /v20/customers/{customer_id}/googleAds:search`

GAQL 쿼리 실행. 페이징은 응답의 `nextPageToken`을 다음 요청 body에 넣음.

요청 body

```json
{
  "query": "SELECT segments.date, campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc FROM campaign WHERE segments.date BETWEEN '2026-03-20' AND '2026-04-19'"
}
```

응답 JSON (예시)

```json
{
  "results": [
    {
      "campaign": {
        "resourceName": "customers/1234567890/campaigns/22335577",
        "id": "22335577",
        "name": "Brand_Search_April",
        "status": "ENABLED"
      },
      "metrics": {
        "impressions": "12450",
        "clicks": "340",
        "costMicros": "85200000",
        "conversions": 14.0,
        "conversionsValue": 580000.0,
        "ctr": 0.0273,
        "averageCpc": "250000"
      },
      "segments": {
        "date": "2026-04-15"
      }
    }
  ],
  "nextPageToken": "CAUQ...",
  "totalResultsCount": "421"
}
```

응답 필드 / 단위 함정

| 필드                          | 타입              | 의미 / 단위                                    |
| ----------------------------- | ----------------- | ---------------------------------------------- |
| `segments.date`               | string            | `YYYY-MM-DD`                                   |
| `campaign.id`                 | string            | 캠페인 ID                                      |
| `campaign.name`               | string            | 캠페인 이름                                    |
| `campaign.status`             | string            | `ENABLED` / `PAUSED` / `REMOVED`               |
| `metrics.impressions`         | string (int)      | 노출 수                                        |
| `metrics.clicks`              | string (int)      | 클릭 수                                        |
| `metrics.costMicros`          | string (int)      | 비용 micros — KRW = `costMicros / 1_000_000`   |
| `metrics.conversions`         | number (float)    | 전환 수 (소수 가능: 부분 어트리뷰션)           |
| `metrics.conversionsValue`    | number (float)    | 전환 가치 (계정 통화)                          |
| `metrics.ctr`                 | number (0~1)      | 비율 — % 환산은 `*100`                         |
| `metrics.averageCpc`          | string (int)      | 평균 CPC micros — KRW = `/1_000_000`           |
| `nextPageToken`               | string?           | 다음 페이지 토큰 (없으면 마지막)               |

### 2-2. 캠페인 메타 (별도 GAQL)

```sql
SELECT campaign.id, campaign.name, campaign.status,
       campaign.advertising_channel_type,
       campaign.start_date, campaign.end_date
FROM campaign
ORDER BY campaign.status, campaign.name
```

응답에서 추가로 사용하는 필드

| 필드                                    | 의미                                             |
| --------------------------------------- | ------------------------------------------------ |
| `campaign.advertisingChannelType`       | `SEARCH` / `DISPLAY` / `VIDEO` / `PERFORMANCE_MAX` 등 |
| `campaign.startDate`, `campaign.endDate`| `YYYY-MM-DD`                                     |

---

## 3. Meta (Facebook) Marketing API

- 어댑터: `lib/channels/meta-ads/adapter.ts`
- API 호스트: `https://graph.facebook.com`
- 사용 버전: `v21.0` (Graph API 버전 정책: 약 2년 후 deprecation)
- 공식 문서
  - Marketing API: https://developers.facebook.com/docs/marketing-api
  - Insights: https://developers.facebook.com/docs/marketing-api/insights
- 환경 변수: `META_ADS_ACCESS_TOKEN`, `META_ADS_ACCOUNT_ID` (`act_` 접두어는 어댑터에서 제거), (선택) `META_ADS_CAMPAIGN_FILTER`

### 인증
시스템 사용자 long-lived access token. 쿼리 파라미터 `access_token`으로 전달.

### 3-1. `GET /v21.0/act_{account_id}/insights`

캠페인 단위 일별 insights.

쿼리 파라미터

| 파라미터        | 값 (어댑터 기본)                                                                   |
| --------------- | ---------------------------------------------------------------------------------- |
| `access_token`  | `{ACCESS_TOKEN}`                                                                   |
| `level`         | `campaign`                                                                         |
| `time_increment`| `1` (일별)                                                                         |
| `time_range`    | `{"since":"2026-03-20","until":"2026-04-19"}` (JSON 문자열)                        |
| `fields`        | `campaign_id,campaign_name,impressions,reach,clicks,spend,ctr,cpc,actions,action_values` |
| `limit`         | `500`                                                                              |
| `filtering`     | (선택) `[{"field":"campaign.name","operator":"CONTAIN","value":"..."}]`            |
| `after`         | (페이징 시) `paging.cursors.after`                                                 |

응답 JSON (예시)

```json
{
  "data": [
    {
      "date_start": "2026-04-15",
      "date_stop": "2026-04-15",
      "campaign_id": "120330000000",
      "campaign_name": "Spring_Promo_Feed",
      "impressions": "84210",
      "reach": "62100",
      "clicks": "1245",
      "spend": "182300",
      "ctr": "1.4783",
      "cpc": "146.4257",
      "actions": [
        { "action_type": "link_click", "value": "1245" },
        { "action_type": "offsite_conversion.fb_pixel_purchase", "value": "12" }
      ],
      "action_values": [
        { "action_type": "offsite_conversion.fb_pixel_purchase", "value": "356000" }
      ]
    }
  ],
  "paging": {
    "cursors": { "before": "MAZD", "after": "MjQZD" },
    "next": "https://graph.facebook.com/v21.0/act_.../insights?after=MjQZD&..."
  }
}
```

응답 필드 / 단위 함정

| 필드                       | 타입           | 의미 / 단위                                                         |
| -------------------------- | -------------- | ------------------------------------------------------------------- |
| `date_start`, `date_stop`  | string         | `YYYY-MM-DD` (`time_increment=1`이면 둘이 같음)                     |
| `campaign_id`              | string         | 캠페인 ID                                                           |
| `campaign_name`            | string         | 캠페인 이름                                                         |
| `impressions`              | string (int)   | 노출                                                                |
| `reach`                    | string (int)   | 도달 (unique users)                                                 |
| `clicks`                   | string (int)   | 모든 클릭 (link_click이 아닌 다른 클릭 포함)                        |
| `spend`                    | string (float) | 비용 — **계정 통화 단위 그대로** (KRW 계정이면 KRW)                 |
| `ctr`                      | string (float) | **이미 % 단위** (Google과 다름)                                     |
| `cpc`                      | string (float) | 평균 CPC, 계정 통화                                                 |
| `actions[]`                | array          | 액션 타입별 카운트                                                  |
| `actions[].action_type`    | string         | `link_click`, `offsite_conversion.fb_pixel_purchase`, `lead`, `add_to_cart`, ... |
| `actions[].value`          | string (int)   | 해당 action_type의 발생 수                                          |
| `action_values[]`          | array          | 액션 타입별 가치 (구매 금액 등)                                     |
| `paging.cursors.after`     | string         | 다음 페이지 커서                                                    |
| `paging.next`              | string?        | 다음 페이지 URL (없으면 마지막)                                     |

⚠️ **현재 어댑터는 `actions` / `action_values`의 모든 `action_type`을 합산**해서 conversions / conversion_value를 계산. 특정 전환만 보려면 (예: 구매만) `offsite_conversion.fb_pixel_purchase` 같이 action_type 필터링 추가 필요.

---

## 4. 정규화된 내부 스키마

각 어댑터는 외부 응답을 다음 공통 스키마로 변환해 어댑터 caller에게 전달. DB 컬럼은 이 스키마와 1:1.

### SOL → `NormalizedDailyRow`

| 필드        | 타입               | 의미                                       |
| ----------- | ------------------ | ------------------------------------------ |
| `date`      | string `YYYY-MM-DD`| KST                                        |
| `channel`   | `'sms' \| 'kakao_biz' \| 'other'` | sub_type 분류 결과         |
| `sub_type`  | string             | `sms` / `lms` / `ata` / ... 원본 sub_type  |
| `sent`      | number             | 발송                                       |
| `successed` | number             | 성공                                       |
| `failed`    | number             | `sent - successed`                         |
| `cost_krw`  | number (정수 KRW)  | 안분 배분 비용                             |

### Google Ads → `GoogleAdsDailyRow`

| 필드               | 타입                 | 의미                                  |
| ------------------ | -------------------- | ------------------------------------- |
| `date`             | string `YYYY-MM-DD`  |                                       |
| `campaign_id`      | string               |                                       |
| `campaign_name`    | string               |                                       |
| `campaign_status`  | string               | `ENABLED` / `PAUSED` / `REMOVED`      |
| `impressions`      | number               |                                       |
| `clicks`           | number               |                                       |
| `cost_krw`         | number (정수 KRW)    | `costMicros / 1_000_000` 반올림       |
| `conversions`      | number               |                                       |
| `conversion_value` | number               |                                       |
| `ctr`              | number (%)           | API 0~1 → `*100`                      |
| `avg_cpc_krw`      | number (정수 KRW)    | `averageCpc / 1_000_000` 반올림       |

### Meta Ads → `MetaAdsDailyRow`

| 필드               | 타입                 | 의미                                                |
| ------------------ | -------------------- | --------------------------------------------------- |
| `date`             | string `YYYY-MM-DD`  | `date_start`                                        |
| `campaign_id`      | string               |                                                     |
| `campaign_name`    | string               |                                                     |
| `impressions`      | number               |                                                     |
| `reach`            | number               |                                                     |
| `clicks`           | number               |                                                     |
| `cost_krw`         | number (정수 KRW)    | `Math.round(spend)` (KRW 계정 가정)                 |
| `conversions`      | number               | 모든 `actions[].value` 합산 (현재)                  |
| `conversion_value` | number               | 모든 `action_values[].value` 합산                   |
| `ctr`              | number (%)           | API 그대로                                          |
| `cpc_krw`          | number (정수 KRW)    | `Math.round(cpc)`                                   |

---

## 5. 공통 규칙

- 모든 어댑터 fetch는 `next: { revalidate: 300 }` → Next.js 데이터 캐시 5분.
- 타임존: 외부 API의 `date` 필드를 그대로 저장. 집계는 KST 기준.
- 통화: 모두 `cost_krw` 정수 KRW로 정규화.
- 페이징: Google Ads는 `nextPageToken`, Meta는 `paging.cursors.after`.
- 어댑터 에러는 채널별로 격리해 throw. 한 채널 실패가 전체 파이프라인을 멈추지 않게 caller에서 try/catch.
