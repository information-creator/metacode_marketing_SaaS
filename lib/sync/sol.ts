import { supabaseService } from '@/lib/supabase/service'
import { getAccountId, seedChannelAccounts } from '@/lib/supabase/seed'
import { fetchSolDailyRows, type NormalizedDailyRow } from '@/lib/channels/sol/adapter'

export type SyncResult = { rows_upserted: number; started_at: string; finished_at: string }

async function ensureCampaign(accountId: string, subType: string): Promise<string> {
  const sb = supabaseService()
  const externalId = `synthetic:${subType}`
  const { data: existing } = await sb
    .from('campaigns')
    .select('id')
    .eq('account_id', accountId)
    .eq('external_id', externalId)
    .maybeSingle()
  if (existing) return existing.id
  const { data, error } = await sb
    .from('campaigns')
    .insert({
      account_id: accountId,
      channel: 'sms_solapi',
      external_id: externalId,
      name: `SOL ${subType.toUpperCase()}`,
      message_type: subType,
    })
    .select('id')
    .single()
  if (error) throw new Error(`ensureCampaign(${subType}): ${error.message}`)
  return data.id
}

export async function syncSol(days = 7): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  const sb = supabaseService()
  await seedChannelAccounts()
  const accountId = await getAccountId('sms_solapi')

  const { data: runRow, error: runErr } = await sb
    .from('sync_runs')
    .insert({ channel: 'sms_solapi', account_id: accountId, status: 'running' })
    .select('id')
    .single()
  if (runErr) throw new Error(`sync_runs insert: ${runErr.message}`)

  try {
    const rows = await fetchSolDailyRows(days)
    const campaignCache = new Map<string, string>()

    const upserts = []
    for (const r of rows) {
      if (!campaignCache.has(r.sub_type)) {
        campaignCache.set(r.sub_type, await ensureCampaign(accountId, r.sub_type))
      }
      upserts.push({
        date: r.date,
        campaign_id: campaignCache.get(r.sub_type)!,
        channel: 'sms_solapi' as const,
        sent_count: r.sent,
        success_count: r.successed,
        failed_count: r.failed,
        cost_krw: r.cost_krw,
        raw: { sub_type: r.sub_type, channel_key: r.channel },
      })
    }

    if (upserts.length > 0) {
      const { error } = await sb
        .from('daily_metrics')
        .upsert(upserts, { onConflict: 'date,campaign_id' })
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
