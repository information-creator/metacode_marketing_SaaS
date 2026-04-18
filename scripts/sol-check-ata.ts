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
  const { fetchSolDailyRows } = await import('../lib/channels/sol/adapter.ts')
  console.log('== SOL /messages/v4/statistics: 최근 120일 ==')
  const rows = await fetchSolDailyRows(120)

  console.log(`총 ${rows.length} 개 row`)
  const byChannel: Record<string, { rows: number; firstDate: string; lastDate: string; sent: number; cost: number }> = {}
  for (const r of rows) {
    const b = byChannel[r.channel] ?? { rows: 0, firstDate: r.date, lastDate: r.date, sent: 0, cost: 0 }
    b.rows++
    if (r.date < b.firstDate) b.firstDate = r.date
    if (r.date > b.lastDate) b.lastDate = r.date
    b.sent += r.sent
    b.cost += r.cost_krw
    byChannel[r.channel] = b
  }
  console.log('\n== 채널별 요약 (SOL API 원본) ==')
  console.table(byChannel)

  console.log('\n== ATA 및 카카오 유형 row (있는 것만) ==')
  const kakao = rows.filter((r) => r.channel === 'kakao_biz')
  if (kakao.length === 0) {
    console.log('❌ 최근 120일 내 SOL API 응답에 kakao_biz 유형 발송이 전혀 없음')
  } else {
    console.table(kakao.map((r) => ({ date: r.date, sub_type: r.sub_type, sent: r.sent, successed: r.successed, failed: r.failed, cost_krw: r.cost_krw })))
  }

  console.log('\n== sub_type 전체 목록 (빈도순) ==')
  const subCount: Record<string, number> = {}
  for (const r of rows) subCount[r.sub_type] = (subCount[r.sub_type] ?? 0) + r.sent
  console.table(Object.entries(subCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ sub_type: k, sent_total: v })))
}
main().catch((e) => { console.error('FATAL:', (e as Error).message); process.exit(1) })
