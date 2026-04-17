import { supabaseService } from '@/lib/supabase/service'
import type { ChannelKey, NormalizedDailyRow } from '@/lib/channels/sol/adapter'
import type { GoogleAdsCampaign, GoogleAdsDailyRow } from '@/lib/channels/google-ads/adapter'
import type { MetaAdsDailyRow } from '@/lib/channels/meta-ads/adapter'
import type { DateRange } from '@/app/_components/date-range'

function rangeBounds(range: DateRange): { from: string; to: string } {
  if (range.mode === 'custom') return { from: range.from, to: range.to }
  const today = new Date()
  const start = new Date(today.getTime() - range.days * 86400000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(start), to: iso(today) }
}

// ============================================================================
// SOL / messaging
// ============================================================================
export async function querySolRows(range: DateRange): Promise<NormalizedDailyRow[]> {
  const sb = supabaseService()
  const { from, to } = rangeBounds(range)
  const { data, error } = await sb
    .from('daily_metrics')
    .select('date, sent_count, success_count, failed_count, cost_krw, raw, campaigns!inner(message_type, channel)')
    .eq('channel', 'sms_solapi')
    .gte('date', from)
    .lte('date', to)
  if (error) throw new Error(`querySolRows: ${error.message}`)

  return (data ?? []).map((r: any) => {
    const sub_type = r.campaigns?.message_type ?? r.raw?.sub_type ?? 'unknown'
    const channelKey: ChannelKey = r.raw?.channel_key ?? classify(sub_type)
    return {
      date: r.date,
      channel: channelKey,
      sub_type,
      sent: Number(r.sent_count ?? 0),
      successed: Number(r.success_count ?? 0),
      failed: Number(r.failed_count ?? 0),
      cost_krw: Number(r.cost_krw ?? 0),
    }
  })
}

function classify(subType: string): ChannelKey {
  const sms = ['sms', 'lms', 'mms']
  const kakao = ['ata', 'cta', 'cti', 'bms_text', 'bms_image', 'bms_wide', 'bms_wide_item_list', 'bms_carousel_feed', 'bms_premium_video', 'bms_commerce', 'bms_carousel_commerce', 'bms_free']
  if (sms.includes(subType)) return 'sms'
  if (kakao.includes(subType)) return 'kakao_biz'
  return 'other'
}

// ============================================================================
// Google Ads
// ============================================================================
export async function queryGoogleDailyRows(range: DateRange): Promise<GoogleAdsDailyRow[]> {
  const sb = supabaseService()
  const { from, to } = rangeBounds(range)
  const { data, error } = await sb
    .from('daily_metrics')
    .select('date, impressions, clicks, conversions, cost_krw, raw, campaigns!inner(external_id, name, status)')
    .eq('channel', 'google_ads')
    .gte('date', from)
    .lte('date', to)
  if (error) throw new Error(`queryGoogleDailyRows: ${error.message}`)

  return (data ?? []).map((r: any) => ({
    date: r.date,
    campaign_id: r.campaigns?.external_id ?? '',
    campaign_name: r.campaigns?.name ?? '',
    campaign_status: r.campaigns?.status ?? '',
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    cost_krw: Number(r.cost_krw ?? 0),
    conversions: Number(r.conversions ?? 0),
    conversion_value: Number(r.raw?.conversion_value ?? 0),
    ctr: Number(r.raw?.ctr ?? 0),
    avg_cpc_krw: Number(r.raw?.avg_cpc_krw ?? 0),
  }))
}

export async function queryAllGoogleCampaigns(): Promise<GoogleAdsCampaign[]> {
  const sb = supabaseService()
  const { data, error } = await sb
    .from('campaigns')
    .select('external_id, name, status, raw')
    .eq('channel', 'google_ads')
  if (error) throw new Error(`queryAllGoogleCampaigns: ${error.message}`)

  return (data ?? []).map((r: any) => ({
    id: r.external_id,
    name: r.name,
    status: r.status ?? '',
    channel_type: r.raw?.channel_type ?? '',
    start_date: r.raw?.start_date ?? '',
    end_date: r.raw?.end_date ?? '',
  }))
}

// ============================================================================
// Meta Ads
// ============================================================================
export async function queryMetaDailyRows(range: DateRange): Promise<MetaAdsDailyRow[]> {
  const sb = supabaseService()
  const { from, to } = rangeBounds(range)
  const { data, error } = await sb
    .from('daily_metrics')
    .select('date, impressions, clicks, conversions, cost_krw, raw, campaigns!inner(external_id, name)')
    .eq('channel', 'meta_ads')
    .gte('date', from)
    .lte('date', to)
  if (error) throw new Error(`queryMetaDailyRows: ${error.message}`)

  return (data ?? []).map((r: any) => ({
    date: r.date,
    campaign_id: r.campaigns?.external_id ?? '',
    campaign_name: r.campaigns?.name ?? '',
    impressions: Number(r.impressions ?? 0),
    reach: Number(r.raw?.reach ?? 0),
    clicks: Number(r.clicks ?? 0),
    cost_krw: Number(r.cost_krw ?? 0),
    conversions: Number(r.conversions ?? 0),
    conversion_value: Number(r.raw?.conversion_value ?? 0),
    ctr: Number(r.raw?.ctr ?? 0),
    cpc_krw: Number(r.raw?.cpc_krw ?? 0),
  }))
}

// ============================================================================
// Sync runs (for /sync page)
// ============================================================================
export async function queryLastSyncRuns(): Promise<Array<{ channel: string; status: string; finished_at: string | null; rows_upserted: number | null; error: string | null }>> {
  const sb = supabaseService()
  const { data, error } = await sb
    .from('sync_runs')
    .select('channel, status, finished_at, rows_upserted, error')
    .order('started_at', { ascending: false })
    .limit(30)
  if (error) throw new Error(`queryLastSyncRuns: ${error.message}`)
  const seen = new Set<string>()
  const out: any[] = []
  for (const r of data ?? []) {
    if (seen.has(r.channel)) continue
    seen.add(r.channel)
    out.push(r)
  }
  return out
}
