import { supabaseService } from '@/lib/supabase/service'
import { getAccountId, seedChannelAccounts } from '@/lib/supabase/seed'
import { fetchAllGoogleAdsCampaigns, fetchGoogleAdsDailyRows } from '@/lib/channels/google-ads/adapter'
import type { SyncResult } from './sol'

export async function syncGoogleAds(days = 7): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  const sb = supabaseService()
  await seedChannelAccounts()
  const accountId = await getAccountId('google_ads')

  const { data: runRow, error: runErr } = await sb
    .from('sync_runs')
    .insert({ channel: 'google_ads', account_id: accountId, status: 'running' })
    .select('id')
    .single()
  if (runErr) throw new Error(`sync_runs insert: ${runErr.message}`)

  try {
    const [campaigns, rows] = await Promise.all([
      fetchAllGoogleAdsCampaigns(),
      fetchGoogleAdsDailyRows(days),
    ])

    // Upsert campaigns
    if (campaigns.length > 0) {
      const rows = campaigns.map((c) => ({
        account_id: accountId,
        channel: 'google_ads' as const,
        external_id: c.id,
        name: c.name,
        status: c.status,
        raw: { channel_type: c.channel_type, start_date: c.start_date, end_date: c.end_date },
      }))
      const { error } = await sb.from('campaigns').upsert(rows, { onConflict: 'account_id,external_id' })
      if (error) throw new Error(`campaigns upsert: ${error.message}`)
    }

    // Load campaign id map
    const { data: campaignMap, error: mapErr } = await sb
      .from('campaigns')
      .select('id, external_id')
      .eq('account_id', accountId)
    if (mapErr) throw new Error(`campaigns load: ${mapErr.message}`)
    const idByExt = new Map(campaignMap.map((c) => [c.external_id, c.id]))

    const upserts = []
    for (const r of rows) {
      const campaignUuid = idByExt.get(r.campaign_id)
      if (!campaignUuid) continue
      upserts.push({
        date: r.date,
        campaign_id: campaignUuid,
        channel: 'google_ads' as const,
        impressions: r.impressions,
        clicks: r.clicks,
        conversions: r.conversions,
        cost_krw: r.cost_krw,
        raw: { ctr: r.ctr, avg_cpc_krw: r.avg_cpc_krw, conversion_value: r.conversion_value },
      })
    }
    if (upserts.length > 0) {
      const { error } = await sb.from('daily_metrics').upsert(upserts, { onConflict: 'date,campaign_id' })
      if (error) throw new Error(`daily_metrics upsert: ${error.message}`)
    }

    const finishedAt = new Date().toISOString()
    await sb
      .from('sync_runs')
      .update({ status: 'success', finished_at: finishedAt, rows_upserted: upserts.length })
      .eq('id', runRow.id)
    return { rows_upserted: upserts.length, started_at: startedAt, finished_at: finishedAt }
  } catch (e) {
    const finishedAt = new Date().toISOString()
    await sb
      .from('sync_runs')
      .update({ status: 'failed', finished_at: finishedAt, error: (e as Error).message })
      .eq('id', runRow.id)
    throw e
  }
}
