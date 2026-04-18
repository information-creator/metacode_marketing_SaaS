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
  const { data } = await sb
    .from('daily_metrics')
    .select('date, sent_count, success_count, cost_krw, raw, campaigns!inner(message_type, external_id)')
    .eq('channel', 'sms_solapi')
  for (const r of data ?? []) {
    const mt = (r as any).campaigns?.message_type
    if (mt === 'ata') {
      console.log({
        date: r.date,
        campaign_ext: (r as any).campaigns?.external_id,
        message_type: mt,
        sent: r.sent_count, success: r.success_count, cost: r.cost_krw,
        raw: r.raw,
      })
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
