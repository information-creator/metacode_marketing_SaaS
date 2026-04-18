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

  console.log('== campaigns (sms_solapi) ==')
  const { data: camps } = await sb
    .from('campaigns')
    .select('external_id, name, message_type, status, raw')
    .eq('channel', 'sms_solapi')
  console.table(camps)

  console.log('\n== daily_metrics (sms_solapi) sample with raw keys ==')
  const { data: dm } = await sb
    .from('daily_metrics')
    .select('date, sent_count, success_count, failed_count, cost_krw, raw, campaigns!inner(message_type)')
    .eq('channel', 'sms_solapi')
    .order('date', { ascending: false })
    .limit(5)
  for (const r of dm ?? []) {
    console.log(JSON.stringify({ date: r.date, sub_type: (r as any).campaigns?.message_type, sent: r.sent_count, cost: r.cost_krw, raw_keys: Object.keys(r.raw ?? {}), raw_sample: r.raw }, null, 2))
  }

  console.log('\n== aggregate by message_type ==')
  const { data: all } = await sb
    .from('daily_metrics')
    .select('sent_count, success_count, failed_count, cost_krw, raw, campaigns!inner(message_type)')
    .eq('channel', 'sms_solapi')
  const agg: Record<string, any> = {}
  for (const r of all ?? []) {
    const mt = (r as any).campaigns?.message_type ?? (r.raw as any)?.sub_type ?? 'unknown'
    const a = agg[mt] ?? { rows: 0, sent: 0, success: 0, failed: 0, cost: 0 }
    a.rows++
    a.sent += Number(r.sent_count ?? 0)
    a.success += Number(r.success_count ?? 0)
    a.failed += Number(r.failed_count ?? 0)
    a.cost += Number(r.cost_krw ?? 0)
    agg[mt] = a
  }
  console.table(agg)
}
main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1) })
