import { NextResponse } from 'next/server'
import { syncSol } from '@/lib/sync/sol'
import { syncGoogleAds } from '@/lib/sync/google-ads'
import { syncMetaAds } from '@/lib/sync/meta-ads'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SYNCS = {
  sms_solapi: syncSol,
  google_ads: syncGoogleAds,
  meta_ads: syncMetaAds,
} as const

async function runSync(channel: string, days: number) {
  if (!(channel in SYNCS)) {
    return NextResponse.json({ error: `unknown channel: ${channel}` }, { status: 400 })
  }
  try {
    const result = await SYNCS[channel as keyof typeof SYNCS](days)
    return NextResponse.json({ ok: true, channel, ...result })
  } catch (e) {
    return NextResponse.json({ ok: false, channel, error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params
  const url = new URL(req.url)
  const days = Number(url.searchParams.get('days')) || 7
  return runSync(channel, days)
}

export async function GET(req: Request, { params }: { params: Promise<{ channel: string }> }) {
  const { channel } = await params
  const url = new URL(req.url)
  const days = Number(url.searchParams.get('days')) || 7

  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }
  return runSync(channel, days)
}
