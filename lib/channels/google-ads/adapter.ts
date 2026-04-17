const API_VERSION = 'v20'
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ADS_API_HOST = 'https://googleads.googleapis.com'

export type GoogleAdsDailyRow = {
  date: string              // YYYY-MM-DD
  campaign_id: string
  campaign_name: string
  campaign_status: string   // ENABLED / PAUSED / REMOVED
  impressions: number
  clicks: number
  cost_krw: number          // cost_micros / 1,000,000, rounded
  conversions: number
  conversion_value: number
  ctr: number               // %
  avg_cpc_krw: number       // KRW
}

export type GoogleAdsCampaign = {
  id: string
  name: string
  status: string
  channel_type: string
  start_date: string
  end_date: string
}

type Creds = {
  developerToken: string
  customerId: string         // 10 digits, no dashes
  loginCustomerId?: string   // MCC id (optional)
  clientId: string
  clientSecret: string
  refreshToken: string
}

function readCreds(): Creds {
  const raw = {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID,
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    clientId: process.env.GOOGLE_ADS_CLIENT_ID,
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  }
  const missing = (['developerToken', 'customerId', 'clientId', 'clientSecret', 'refreshToken'] as const).filter(
    (k) => !raw[k],
  )
  if (missing.length) {
    throw new Error(`Google Ads env missing: ${missing.map((k) => `GOOGLE_ADS_${k.replace(/([A-Z])/g, '_$1').toUpperCase()}`).join(', ')}`)
  }
  return {
    developerToken: raw.developerToken!,
    customerId: raw.customerId!.replaceAll('-', ''),
    loginCustomerId: raw.loginCustomerId ? raw.loginCustomerId.replaceAll('-', '') : undefined,
    clientId: raw.clientId!,
    clientSecret: raw.clientSecret!,
    refreshToken: raw.refreshToken!,
  }
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(creds: Creds): Promise<string> {
  const now = Date.now()
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60_000) {
    return cachedAccessToken.token
  }
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    next: { revalidate: 300 },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`OAuth token refresh failed (${res.status}): ${text}`)
  const json = JSON.parse(text) as { access_token: string; expires_in: number }
  cachedAccessToken = { token: json.access_token, expiresAt: now + json.expires_in * 1000 }
  return json.access_token
}

async function gaqlSearch(creds: Creds, query: string): Promise<any[]> {
  const accessToken = await getAccessToken(creds)
  const url = `${ADS_API_HOST}/${API_VERSION}/customers/${creds.customerId}/googleAds:search`
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': creds.developerToken,
    'Content-Type': 'application/json',
  }
  if (creds.loginCustomerId) headers['login-customer-id'] = creds.loginCustomerId

  const results: any[] = []
  let pageToken: string | undefined
  do {
    const body: Record<string, unknown> = { query }
    if (pageToken) body.pageToken = pageToken
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      next: { revalidate: 300 },
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`Google Ads API ${res.status}: ${text}`)
    const json = JSON.parse(text) as { results?: any[]; nextPageToken?: string }
    if (json.results) results.push(...json.results)
    pageToken = json.nextPageToken
  } while (pageToken)
  return results
}

export async function fetchGoogleAdsDailyRows(days = 30): Promise<GoogleAdsDailyRow[]> {
  const creds = readCreds()
  const today = new Date()
  const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const query = `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM campaign
    WHERE segments.date BETWEEN '${iso(start)}' AND '${iso(today)}'
  `.trim()

  const results = await gaqlSearch(creds, query)
  const rows: GoogleAdsDailyRow[] = results.map((r) => {
    const impressions = Number(r.metrics?.impressions ?? 0)
    const clicks = Number(r.metrics?.clicks ?? 0)
    const cost_micros = Number(r.metrics?.costMicros ?? 0)
    const avg_cpc_micros = Number(r.metrics?.averageCpc ?? 0)
    return {
      date: String(r.segments?.date ?? ''),
      campaign_id: String(r.campaign?.id ?? ''),
      campaign_name: String(r.campaign?.name ?? ''),
      campaign_status: String(r.campaign?.status ?? ''),
      impressions,
      clicks,
      cost_krw: Math.round(cost_micros / 1_000_000),
      conversions: Number(r.metrics?.conversions ?? 0),
      conversion_value: Number(r.metrics?.conversionsValue ?? 0),
      ctr: Number(r.metrics?.ctr ?? 0) * 100,
      avg_cpc_krw: Math.round(avg_cpc_micros / 1_000_000),
    }
  })
  rows.sort((a, b) => (a.date + a.campaign_id).localeCompare(b.date + b.campaign_id))
  return rows
}

export async function fetchAllGoogleAdsCampaigns(): Promise<GoogleAdsCampaign[]> {
  const creds = readCreds()
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.start_date,
      campaign.end_date
    FROM campaign
    ORDER BY campaign.status, campaign.name
  `.trim()
  const results = await gaqlSearch(creds, query)
  return results.map((r) => ({
    id: String(r.campaign?.id ?? ''),
    name: String(r.campaign?.name ?? ''),
    status: String(r.campaign?.status ?? ''),
    channel_type: String(r.campaign?.advertisingChannelType ?? ''),
    start_date: String(r.campaign?.startDate ?? ''),
    end_date: String(r.campaign?.endDate ?? ''),
  }))
}

export function aggregateGoogleAds(rows: GoogleAdsDailyRow[]) {
  const total = {
    impressions: 0,
    clicks: 0,
    cost_krw: 0,
    conversions: 0,
    conversion_value: 0,
  }
  for (const r of rows) {
    total.impressions += r.impressions
    total.clicks += r.clicks
    total.cost_krw += r.cost_krw
    total.conversions += r.conversions
    total.conversion_value += r.conversion_value
  }
  const ctr = total.impressions > 0 ? (total.clicks / total.impressions) * 100 : 0
  const cpc = total.clicks > 0 ? total.cost_krw / total.clicks : 0
  const cpa = total.conversions > 0 ? total.cost_krw / total.conversions : 0
  const roas = total.cost_krw > 0 ? total.conversion_value / total.cost_krw : 0
  return { total, ctr, cpc, cpa, roas }
}
