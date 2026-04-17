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
  const { supabaseService } = await import('../lib/supabase/service.ts')
  const sb = supabaseService()
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  // Try a simple auth-only endpoint (works on any project)
  const { data, error } = await sb.from('pg_catalog.pg_tables').select('*').limit(1)
  if (error) {
    console.log('Test query error (expected if schema not yet applied):', error.message)
  } else {
    console.log('Connected. Got rows:', data?.length ?? 0)
  }

  // Try listing public tables via rpc or system table - using PostgREST introspection
  const introspectRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
  })
  const introspectText = await introspectRes.text()
  console.log('\n== REST introspection (/rest/v1/) ==')
  console.log('HTTP', introspectRes.status)
  try {
    const parsed = JSON.parse(introspectText)
    console.log('paths:', Object.keys(parsed.paths ?? {}).slice(0, 20))
  } catch {
    console.log('body (first 200 chars):', introspectText.slice(0, 200))
  }
}
main().catch((e) => {
  console.error('FATAL:', (e as Error).message)
  process.exit(1)
})
