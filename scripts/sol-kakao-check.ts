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
  const { fetchSolDailyRows } = await import('../lib/channels/sol/adapter.ts')
  for (const days of [30, 90, 180, 365]) {
    console.log(`\n== Last ${days} days ==`)
    const rows = await fetchSolDailyRows(days)
    const bySubType = new Map<string, number>()
    for (const r of rows) {
      bySubType.set(r.sub_type, (bySubType.get(r.sub_type) ?? 0) + r.sent)
    }
    const sorted = Array.from(bySubType.entries()).sort((a, b) => b[1] - a[1])
    console.table(sorted.map(([sub_type, sent]) => ({ sub_type, sent })))
  }
}
main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
