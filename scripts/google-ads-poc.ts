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

async function main() {
  const { fetchGoogleAdsDailyRows, aggregateGoogleAds } = await import('../lib/channels/google-ads/adapter.ts')

  console.log('== Google Ads PoC ==')
  console.log('customer:', process.env.GOOGLE_ADS_CUSTOMER_ID)
  console.log('login_customer (MCC):', process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '(none — assuming direct access)')

  try {
    const rows = await fetchGoogleAdsDailyRows(30)
    console.log(`\nrows: ${rows.length}`)

    if (rows.length === 0) {
      console.log('(no campaigns with activity in last 30d)')
      return
    }

    console.log('\nfirst row sample:')
    console.log(rows[0])

    const agg = aggregateGoogleAds(rows)
    console.log('\naggregate (30d):')
    console.table({
      impressions: agg.total.impressions.toLocaleString(),
      clicks: agg.total.clicks.toLocaleString(),
      cost_krw: `₩${agg.total.cost_krw.toLocaleString()}`,
      conversions: agg.total.conversions.toFixed(2),
      CTR: `${agg.ctr.toFixed(2)}%`,
      CPC: `₩${Math.round(agg.cpc).toLocaleString()}`,
      CPA: agg.total.conversions > 0 ? `₩${Math.round(agg.cpa).toLocaleString()}` : '-',
      ROAS: agg.total.conversions > 0 ? `${agg.roas.toFixed(2)}x` : '-',
    })

    const byCampaign = new Map<string, { name: string; cost: number; clicks: number }>()
    for (const r of rows) {
      const e = byCampaign.get(r.campaign_id) ?? { name: r.campaign_name, cost: 0, clicks: 0 }
      e.cost += r.cost_krw
      e.clicks += r.clicks
      byCampaign.set(r.campaign_id, e)
    }
    console.log('\ntop campaigns by cost:')
    console.table(
      Array.from(byCampaign.entries())
        .sort((a, b) => b[1].cost - a[1].cost)
        .slice(0, 10)
        .map(([id, v]) => ({ id, name: v.name, cost_krw: v.cost, clicks: v.clicks })),
    )
  } catch (e) {
    console.error('\nERROR:', (e as Error).message)
    process.exit(1)
  }
}

main()
