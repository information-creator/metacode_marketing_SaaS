import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}
loadEnvLocal()

async function main() {
  const { supabaseService } = await import('../lib/supabase/service.ts')
  const sb = supabaseService()

  console.log('== channel_accounts ==')
  const { data: accts } = await sb.from('channel_accounts').select('channel, external_id, display_name, is_active')
  console.table(accts)

  console.log('\n== campaigns (count by channel) ==')
  for (const ch of ['sms_solapi', 'kakao_biz', 'google_ads', 'meta_ads']) {
    const { count } = await sb.from('campaigns').select('*', { count: 'exact', head: true }).eq('channel', ch)
    console.log(`  ${ch}: ${count ?? 0}`)
  }

  console.log('\n== daily_metrics (by channel: rows, date range) ==')
  for (const ch of ['sms_solapi', 'kakao_biz', 'google_ads', 'meta_ads']) {
    const { count } = await sb.from('daily_metrics').select('*', { count: 'exact', head: true }).eq('channel', ch)
    const { data: minR } = await sb.from('daily_metrics').select('date').eq('channel', ch).order('date', { ascending: true }).limit(1)
    const { data: maxR } = await sb.from('daily_metrics').select('date').eq('channel', ch).order('date', { ascending: false }).limit(1)
    console.log(`  ${ch}: ${count ?? 0} rows, ${minR?.[0]?.date ?? '-'} ~ ${maxR?.[0]?.date ?? '-'}`)
  }

  console.log('\n== daily_metrics totals (all time, by channel) ==')
  const { data: sample } = await sb
    .from('daily_metrics')
    .select('channel, impressions, clicks, conversions, cost_krw, sent_count, success_count, failed_count')
  const agg: Record<string, any> = {}
  for (const r of sample ?? []) {
    const a = agg[r.channel] ?? { rows: 0, impressions: 0, clicks: 0, conversions: 0, cost_krw: 0, sent: 0, success: 0, failed: 0 }
    a.rows++
    a.impressions += Number(r.impressions ?? 0)
    a.clicks += Number(r.clicks ?? 0)
    a.conversions += Number(r.conversions ?? 0)
    a.cost_krw += Number(r.cost_krw ?? 0)
    a.sent += Number(r.sent_count ?? 0)
    a.success += Number(r.success_count ?? 0)
    a.failed += Number(r.failed_count ?? 0)
    agg[r.channel] = a
  }
  console.table(agg)

  console.log('\n== sync_runs (last 10) ==')
  const { data: runs } = await sb
    .from('sync_runs')
    .select('channel, status, started_at, finished_at, rows_upserted, date_from, date_to, error')
    .order('started_at', { ascending: false })
    .limit(10)
  console.table(runs)
}
main().catch((e) => {
  console.error('FATAL:', (e as Error).message)
  process.exit(1)
})
