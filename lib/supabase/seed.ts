import { supabaseService } from './service'

export async function seedChannelAccounts(): Promise<void> {
  const sb = supabaseService()
  const accounts = [
    {
      channel: 'sms_solapi' as const,
      external_id: 'default',
      display_name: '문자하랑 (기본)',
      config: {},
      is_active: true,
    },
    {
      channel: 'google_ads' as const,
      external_id: process.env.GOOGLE_ADS_CUSTOMER_ID ?? 'unknown',
      display_name: 'Google Ads (2242068833)',
      config: { customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID },
      is_active: true,
    },
    {
      channel: 'meta_ads' as const,
      external_id: process.env.META_ADS_ACCOUNT_ID ?? 'unknown',
      display_name: `Meta Ads (act_${process.env.META_ADS_ACCOUNT_ID})`,
      config: { ad_account_id: process.env.META_ADS_ACCOUNT_ID },
      is_active: true,
    },
  ]
  for (const a of accounts) {
    const { error } = await sb
      .from('channel_accounts')
      .upsert(a, { onConflict: 'channel,external_id' })
    if (error) throw new Error(`seed ${a.channel}: ${error.message}`)
  }
}

export async function getAccountId(channel: string): Promise<string> {
  const sb = supabaseService()
  const { data, error } = await sb
    .from('channel_accounts')
    .select('id')
    .eq('channel', channel)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`getAccountId(${channel}): ${error.message}`)
  if (!data) throw new Error(`no active channel_account for ${channel}`)
  return data.id
}
