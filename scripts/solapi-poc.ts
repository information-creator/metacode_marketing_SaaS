import { createHmac, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const API_HOST = 'https://api.solapi.com'

function loadEnvLocal(): Record<string, string> {
  const path = resolve(process.cwd(), '.env.local')
  const text = readFileSync(path, 'utf8')
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString()
  const salt = randomBytes(32).toString('hex')
  const signature = createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

async function solapiGet<T>(path: string, query: Record<string, string | number>, apiKey: string, apiSecret: string): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(query).map(([k, v]) => [k, String(v)]),
  ).toString()
  const url = `${API_HOST}${path}${qs ? `?${qs}` : ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: buildAuthHeader(apiKey, apiSecret),
      'Content-Type': 'application/json',
    },
  })
  const bodyText = await res.text()
  if (!res.ok) {
    throw new Error(`SOLAPI ${path} ${res.status}: ${bodyText}`)
  }
  return JSON.parse(bodyText) as T
}

function maskRecipient(num: string | undefined): string {
  if (!num) return ''
  const digits = num.replace(/\D/g, '')
  if (digits.length < 7) return '***'
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

async function main() {
  const env = loadEnvLocal()
  const apiKey = env.SOLAPI_API_KEY
  const apiSecret = env.SOLAPI_API_SECRET
  if (!apiKey || !apiSecret) {
    throw new Error('SOLAPI_API_KEY / SOLAPI_API_SECRET not set in .env.local')
  }

  const today = new Date()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const iso = (d: Date) => d.toISOString()

  console.log('== SOLAPI PoC ==')
  console.log(`range: ${iso(weekAgo)} ~ ${iso(today)}\n`)

  // 1) 최근 발송 내역 (list)
  console.log('[1] GET /messages/v4/list (limit=5)')
  try {
    const list = await solapiGet<any>(
      '/messages/v4/list',
      {
        limit: 5,
        startDate: iso(weekAgo),
        endDate: iso(today),
      },
      apiKey,
      apiSecret,
    )
    const items = list?.messageList
      ? Object.values(list.messageList)
      : Array.isArray(list) ? list : []
    console.log(`  total: ${list?.limit ?? items.length} items returned`)
    const sample = (items[0] as any) ?? null
    if (sample) {
      console.log('  sample keys:', Object.keys(sample))
      console.log('  sample (masked):', {
        messageId: sample.messageId,
        type: sample.type,
        status: sample.status,
        statusCode: sample.statusCode,
        to: maskRecipient(sample.to),
        from: maskRecipient(sample.from),
        dateCreated: sample.dateCreated,
        dateUpdated: sample.dateUpdated,
      })
    } else {
      console.log('  (no messages in range)')
    }
  } catch (e) {
    console.error('  ERROR:', (e as Error).message)
  }

  // 2) 통계
  console.log('\n[2] GET /messages/v4/statistics (last 7d, no masterAccountId)')
  try {
    const stats = await solapiGet<any>(
      '/messages/v4/statistics',
      {
        startDate: weekAgo.toISOString().slice(0, 10),
        endDate: today.toISOString().slice(0, 10),
      },
      apiKey,
      apiSecret,
    )
    console.log('  top-level keys:', Object.keys(stats ?? {}))
    console.log(JSON.stringify(stats, null, 2).slice(0, 2000))
  } catch (e) {
    console.error('  ERROR:', (e as Error).message)
  }

  // 2b) 통계 대안: /messages/v4/list 로 집계 (date + type + status 별 카운트)
  console.log('\n[2b] Aggregate from /messages/v4/list (limit=500)')
  try {
    const list = await solapiGet<any>(
      '/messages/v4/list',
      {
        limit: 500,
        startDate: iso(weekAgo),
        endDate: iso(today),
      },
      apiKey,
      apiSecret,
    )
    const items: any[] = list?.messageList
      ? Object.values(list.messageList)
      : Array.isArray(list) ? list : []
    const agg: Record<string, { total: number; complete: number; failed: number }> = {}
    for (const m of items) {
      const date = (m.dateCreated || '').slice(0, 10)
      const type = m.type || 'UNKNOWN'
      const key = `${date} | ${type}`
      agg[key] ??= { total: 0, complete: 0, failed: 0 }
      agg[key].total++
      if (m.statusCode === '4000') agg[key].complete++
      else agg[key].failed++
    }
    console.log(`  items pulled: ${items.length}`)
    console.table(
      Object.entries(agg)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ key: k, ...v })),
    )
  } catch (e) {
    console.error('  ERROR:', (e as Error).message)
  }

  // 3) 잔액 (조회용 키 유효성 체크 보너스)
  console.log('\n[3] GET /cash/v1/balance')
  try {
    const balance = await solapiGet<any>('/cash/v1/balance', {}, apiKey, apiSecret)
    console.log('  balance:', balance)
  } catch (e) {
    console.error('  ERROR:', (e as Error).message)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
