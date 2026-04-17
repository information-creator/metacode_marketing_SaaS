const API_VERSION = 'v21.0'
const GRAPH_HOST = 'https://graph.facebook.com'

export type MetaAdsDailyRow = {
  date: string              // YYYY-MM-DD
  campaign_id: string
  campaign_name: string
  impressions: number
  reach: number
  clicks: number
  cost_krw: number          // spend (assumed KRW based on account currency)
  conversions: number       // sum of actions (or specific action_type)
  conversion_value: number  // sum of action_values
  ctr: number               // %
  cpc_krw: number           // KRW
}

type Creds = {
  accessToken: string
  accountId: string        // no "act_" prefix
  campaignFilter?: string  // optional CONTAIN filter on campaign.name
}

function readCreds(): Creds {
  const accessToken = process.env.META_ADS_ACCESS_TOKEN
  const accountId = process.env.META_ADS_ACCOUNT_ID
  const campaignFilter = process.env.META_ADS_CAMPAIGN_FILTER
  const missing: string[] = []
  if (!accessToken) missing.push('META_ADS_ACCESS_TOKEN')
  if (!accountId) missing.push('META_ADS_ACCOUNT_ID')
  if (missing.length) throw new Error(`Meta Ads env missing: ${missing.join(', ')}`)
  return {
    accessToken: accessToken!,
    accountId: accountId!.replace(/^act_/, ''),
    campaignFilter: campaignFilter || undefined,
  }
}

type InsightsItem = {
  date_start: string
  date_stop: string
  campaign_id: string
  campaign_name: string
  impressions?: string
  reach?: string
  clicks?: string
  spend?: string
  ctr?: string
  cpc?: string
  actions?: Array<{ action_type: string; value: string }>
  action_values?: Array<{ action_type: string; value: string }>
}

async function graphGet<T>(path: string, query: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(query).toString()
  const url = `${GRAPH_HOST}/${API_VERSION}${path}?${qs}`
  const res = await fetch(url, { method: 'GET', next: { revalidate: 300 } })
  const text = await res.text()
  if (!res.ok) throw new Error(`Meta Graph ${path} ${res.status}: ${text}`)
  return JSON.parse(text) as T
}

function sumActionValues(list: Array<{ action_type: string; value: string }> | undefined): number {
  if (!list) return 0
  return list.reduce((a, it) => a + Number(it.value || 0), 0)
}

export async function fetchMetaAdsDailyRows(days = 30): Promise<MetaAdsDailyRow[]> {
  const creds = readCreds()
  const today = new Date()
  const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const query: Record<string, string> = {
    access_token: creds.accessToken,
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since: iso(start), until: iso(today) }),
    fields: 'campaign_id,campaign_name,impressions,reach,clicks,spend,ctr,cpc,actions,action_values',
    limit: '500',
  }
  if (creds.campaignFilter) {
    query.filtering = JSON.stringify([
      { field: 'campaign.name', operator: 'CONTAIN', value: creds.campaignFilter },
    ])
  }

  const rows: MetaAdsDailyRow[] = []
  let afterCursor: string | undefined
  do {
    if (afterCursor) query.after = afterCursor
    const json = await graphGet<{ data: InsightsItem[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      `/act_${creds.accountId}/insights`,
      query,
    )
    for (const it of json.data ?? []) {
      const conversions = sumActionValues(it.actions)
      const conversion_value = sumActionValues(it.action_values)
      rows.push({
        date: it.date_start,
        campaign_id: it.campaign_id,
        campaign_name: it.campaign_name,
        impressions: Number(it.impressions ?? 0),
        reach: Number(it.reach ?? 0),
        clicks: Number(it.clicks ?? 0),
        cost_krw: Math.round(Number(it.spend ?? 0)),
        conversions,
        conversion_value,
        ctr: Number(it.ctr ?? 0),
        cpc_krw: Math.round(Number(it.cpc ?? 0)),
      })
    }
    afterCursor = json.paging?.next ? json.paging.cursors?.after : undefined
  } while (afterCursor)

  rows.sort((a, b) => (a.date + a.campaign_id).localeCompare(b.date + b.campaign_id))
  return rows
}

export function aggregateMetaAds(rows: MetaAdsDailyRow[]) {
  const total = {
    impressions: 0,
    reach: 0,
    clicks: 0,
    cost_krw: 0,
    conversions: 0,
    conversion_value: 0,
  }
  for (const r of rows) {
    total.impressions += r.impressions
    total.reach += r.reach
    total.clicks += r.clicks
    total.cost_krw += r.cost_krw
    total.conversions += r.conversions
    total.conversion_value += r.conversion_value
  }
  const ctr = total.impressions > 0 ? (total.clicks / total.impressions) * 100 : 0
  const cpc = total.clicks > 0 ? total.cost_krw / total.clicks : 0
  const cpa = total.conversions > 0 ? total.cost_krw / total.conversions : 0
  const roas = total.cost_krw > 0 ? total.conversion_value / total.cost_krw : 0
  const cpm = total.impressions > 0 ? (total.cost_krw / total.impressions) * 1000 : 0
  return { total, ctr, cpc, cpa, roas, cpm }
}
