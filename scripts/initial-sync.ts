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
  console.log('== Initial Sync (last 365 days for backfill) ==\n')
  const { syncSol } = await import('../lib/sync/sol.ts')
  const { syncGoogleAds } = await import('../lib/sync/google-ads.ts')
  const { syncMetaAds } = await import('../lib/sync/meta-ads.ts')

  for (const [name, fn] of [
    ['SOL', syncSol],
    ['Google Ads', syncGoogleAds],
    ['Meta Ads', syncMetaAds],
  ] as const) {
    console.log(`>> ${name} ...`)
    try {
      const r = await fn(365)
      console.log(`   ✅ upserted ${r.rows_upserted} rows in ${((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000).toFixed(1)}s\n`)
    } catch (e) {
      console.error(`   ❌ ${(e as Error).message}\n`)
    }
  }
}
main().catch((e) => {
  console.error('FATAL:', (e as Error).message)
  process.exit(1)
})
