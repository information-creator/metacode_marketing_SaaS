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
  const { fetchMetaAdsDailyRows, aggregateMetaAds } = await import('../lib/channels/meta-ads/adapter.ts')
  console.log('== Meta Ads PoC ==')
  console.log('account:', process.env.META_ADS_ACCOUNT_ID)
  console.log('filter:', process.env.META_ADS_CAMPAIGN_FILTER || '(none)')

  try {
    const rows = await fetchMetaAdsDailyRows(30)
    console.log(`\nrows: ${rows.length}`)
    if (rows.length === 0) {
      console.log('(no campaigns with activity in last 30d)')
      return
    }
    console.log('\nfirst row:')
    console.log(rows[0])

    const agg = aggregateMetaAds(rows)
    console.log('\naggregate (30d):')
    console.table({
      impressions: agg.total.impressions.toLocaleString(),
      reach: agg.total.reach.toLocaleString(),
      clicks: agg.total.clicks.toLocaleString(),
      cost_krw: `₩${agg.total.cost_krw.toLocaleString()}`,
      conversions: agg.total.conversions.toFixed(2),
      CTR: `${agg.ctr.toFixed(2)}%`,
      CPC: `₩${Math.round(agg.cpc).toLocaleString()}`,
      CPM: `₩${Math.round(agg.cpm).toLocaleString()}`,
    })

    const byCampaign = new Map<string, { name: string; cost: number; clicks: number }>()
    for (const r of rows) {
      const e = byCampaign.get(r.campaign_id) ?? { name: r.campaign_name, cost: 0, clicks: 0 }
      e.cost += r.cost_krw
      e.clicks += r.clicks
      byCampaign.set(r.campaign_id, e)
    }
    console.log('\ntop campaigns:')
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
