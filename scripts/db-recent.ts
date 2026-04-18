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

  for (const ch of ['sms_solapi', 'google_ads', 'meta_ads']) {
    console.log(`\n== ${ch}: 최근 14일 per-date 집계 ==`)
    const { data } = await sb
      .from('daily_metrics')
      .select('date, impressions, clicks, conversions, cost_krw, sent_count, success_count, failed_count')
      .eq('channel', ch)
      .order('date', { ascending: false })
    const byDate: Record<string, any> = {}
    for (const r of data ?? []) {
      const a = byDate[r.date] ?? { rows: 0, impressions: 0, clicks: 0, conv: 0, cost: 0, sent: 0, succ: 0, fail: 0 }
      a.rows++
      a.impressions += Number(r.impressions ?? 0)
      a.clicks += Number(r.clicks ?? 0)
      a.conv += Number(r.conversions ?? 0)
      a.cost += Number(r.cost_krw ?? 0)
      a.sent += Number(r.sent_count ?? 0)
      a.succ += Number(r.success_count ?? 0)
      a.fail += Number(r.failed_count ?? 0)
      byDate[r.date] = a
    }
    const dates = Object.keys(byDate).sort().reverse().slice(0, 14).reverse()
    const table = dates.map(d => ({ date: d, ...byDate[d] }))
    console.table(table)
  }
}
main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1) })
