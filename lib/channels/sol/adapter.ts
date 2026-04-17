import { createHmac, randomBytes } from 'node:crypto'

const API_HOST = 'https://api.solapi.com'

const SMS_TYPES = ['sms', 'lms', 'mms'] as const
const KAKAO_TYPES = [
  'ata', 'cta', 'cti',
  'bms_text', 'bms_image', 'bms_wide', 'bms_wide_item_list',
  'bms_carousel_feed', 'bms_premium_video', 'bms_commerce',
  'bms_carousel_commerce', 'bms_free',
] as const

export type ChannelKey = 'sms' | 'kakao_biz' | 'other'

export type NormalizedDailyRow = {
  date: string            // YYYY-MM-DD (KST)
  channel: ChannelKey
  sub_type: string        // sms / lms / mms / ata / cta / cti / ...
  sent: number
  successed: number
  failed: number
  cost_krw: number        // proportional to share of the day's balance
}

type DayPeriod = {
  date: string            // YYYY/MM/DD
  balance: number
  total: Record<string, number>
  successed: Record<string, number>
}

type StatisticsResponse = {
  monthPeriod: Array<{ date: string; dayPeriod: DayPeriod[] }>
}

export type SolBalance = {
  balance: number
  point: number
  deposit: number
  autoRecharge: number
  minimumCash: number
}

function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString()
  const salt = randomBytes(32).toString('hex')
  const signature = createHmac('sha256', apiSecret)
    .update(date + salt)
    .digest('hex')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

async function solGet<T>(path: string, query: Record<string, string>, key: string, secret: string): Promise<T> {
  const qs = new URLSearchParams(query).toString()
  const url = `${API_HOST}${path}${qs ? `?${qs}` : ''}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: buildAuthHeader(key, secret),
      'Content-Type': 'application/json',
    },
    next: { revalidate: 300 },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`SOLAPI ${path} ${res.status}: ${text}`)
  return JSON.parse(text) as T
}

function classify(subType: string): ChannelKey {
  if ((SMS_TYPES as readonly string[]).includes(subType)) return 'sms'
  if ((KAKAO_TYPES as readonly string[]).includes(subType)) return 'kakao_biz'
  return 'other'
}

function credentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.SOLAPI_API_KEY
  const apiSecret = process.env.SOLAPI_API_SECRET
  if (!apiKey || !apiSecret) throw new Error('SOLAPI_API_KEY / SOLAPI_API_SECRET not set')
  return { apiKey, apiSecret }
}

export async function fetchSolDailyRows(days = 30): Promise<NormalizedDailyRow[]> {
  const { apiKey, apiSecret } = credentials()
  const today = new Date()
  const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const stats = await solGet<StatisticsResponse>(
    '/messages/v4/statistics',
    { startDate: iso(start), endDate: iso(today) },
    apiKey,
    apiSecret,
  )

  const rows: NormalizedDailyRow[] = []
  for (const month of stats.monthPeriod ?? []) {
    for (const day of month.dayPeriod ?? []) {
      const date = day.date.replaceAll('/', '-')
      const totalDaySent = Object.entries(day.total)
        .filter(([k, v]) => k !== 'total' && typeof v === 'number')
        .reduce((a, [, v]) => a + (v as number), 0)

      for (const [subType, sent] of Object.entries(day.total)) {
        if (subType === 'total' || typeof sent !== 'number' || sent === 0) continue
        const successed = typeof day.successed?.[subType] === 'number' ? day.successed[subType] : 0
        const failed = Math.max(sent - successed, 0)
        const cost_krw = totalDaySent > 0 ? Math.round((day.balance * sent) / totalDaySent) : 0
        rows.push({
          date,
          channel: classify(subType),
          sub_type: subType,
          sent,
          successed,
          failed,
          cost_krw,
        })
      }
    }
  }
  rows.sort((a, b) => (a.date + a.sub_type).localeCompare(b.date + b.sub_type))
  return rows
}

export async function fetchSolBalance(): Promise<SolBalance> {
  const { apiKey, apiSecret } = credentials()
  const res = await solGet<any>('/cash/v1/balance', {}, apiKey, apiSecret)
  return {
    balance: res.balance ?? 0,
    point: res.point ?? 0,
    deposit: res.deposit ?? 0,
    autoRecharge: res.autoRecharge ?? 0,
    minimumCash: res.minimumCash ?? 0,
  }
}

export function aggregateByChannel(rows: NormalizedDailyRow[]): Record<ChannelKey, { sent: number; successed: number; failed: number; cost_krw: number }> {
  const acc: Record<ChannelKey, { sent: number; successed: number; failed: number; cost_krw: number }> = {
    sms: { sent: 0, successed: 0, failed: 0, cost_krw: 0 },
    kakao_biz: { sent: 0, successed: 0, failed: 0, cost_krw: 0 },
    other: { sent: 0, successed: 0, failed: 0, cost_krw: 0 },
  }
  for (const r of rows) {
    acc[r.channel].sent += r.sent
    acc[r.channel].successed += r.successed
    acc[r.channel].failed += r.failed
    acc[r.channel].cost_krw += r.cost_krw
  }
  return acc
}
