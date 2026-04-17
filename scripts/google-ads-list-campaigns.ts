import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}
loadEnvLocal()

const API_VERSION = 'v20'
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'

async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
    refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    grant_type: 'refresh_token',
  })
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  return ((await res.json()) as any).access_token
}

async function search(query: string): Promise<any[]> {
  const token = await getAccessToken()
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!.replaceAll('-', '')
  const res = await fetch(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status}: ${text}`)
  return JSON.parse(text).results ?? []
}

async function main() {
  console.log('== Google Ads Account Inventory ==')
  console.log('customer:', process.env.GOOGLE_ADS_CUSTOMER_ID)

  const all = await search(`
    SELECT campaign.id, campaign.name, campaign.status, campaign.start_date, campaign.end_date,
           campaign.advertising_channel_type
    FROM campaign
    ORDER BY campaign.status, campaign.name
  `)
  console.log(`\nTotal campaigns (all statuses): ${all.length}`)
  console.table(
    all.map((r) => ({
      id: r.campaign?.id,
      name: r.campaign?.name,
      status: r.campaign?.status,
      channel: r.campaign?.advertisingChannelType,
      start: r.campaign?.startDate,
      end: r.campaign?.endDate,
    })),
  )

  console.log('\n--- Ad Groups (under AI-MBTI_CAMP) ---')
  const adGroups = await search(`
    SELECT ad_group.id, ad_group.name, ad_group.status, campaign.name,
           metrics.impressions, metrics.clicks, metrics.cost_micros
    FROM ad_group
    WHERE segments.date DURING LAST_30_DAYS
  `)
  console.table(
    adGroups.map((r) => ({
      adGroup: r.adGroup?.name,
      status: r.adGroup?.status,
      campaign: r.campaign?.name,
      impr: r.metrics?.impressions,
      clk: r.metrics?.clicks,
      cost: Math.round(Number(r.metrics?.costMicros ?? 0) / 1_000_000),
    })),
  )
}
main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
