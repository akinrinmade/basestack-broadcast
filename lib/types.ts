export type SubscriberStatus = 'pending' | 'active' | 'unsubscribed' | 'suppressed'
export type SubscriberSource = 'manual' | 'csv_import' | 'public_signup'

export interface Subscriber {
  id: string
  name: string | null
  email: string
  status: SubscriberStatus
  source: SubscriberSource
  unsubscribe_token: string
  confirm_token: string
  confirmed_at: string | null
  unsubscribed_at: string | null
  suppression_reason: string | null
  bounce_count: number
  signup_ip: string | null
  created_at: string
  updated_at: string
}

export interface SubscriberInput {
  name: string | null
  email: string
  status: SubscriberStatus
  source: SubscriberSource
}

export interface Settings {
  id: number
  sender_name: string
  reply_to_email: string | null
  mailing_address: string | null
  updated_at: string
}

export interface SettingsInput {
  sender_name: string
  reply_to_email: string | null
  mailing_address: string | null
}

export interface DashboardStats {
  total: number
  active: number
  pending: number
  unsubscribed: number
  suppressed: number
}

export interface CsvRow {
  rowNumber: number
  name: string
  email: string
  valid: boolean
  reason?: string
}

export interface CsvPreview {
  validRows: CsvRow[]
  invalidRows: CsvRow[]
  duplicateEmailsInCsv: number[]
  duplicateEmailsInDb: string[]
  totalValid: number
  totalInvalid: number
}

// =========================================================
// Campaigns
// =========================================================

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'

export type RecipientMode = 'all_active' | 'selected'

export interface RecipientFilter {
  mode: RecipientMode
  subscriber_ids?: string[]
}

export interface Campaign {
  id: string
  name: string
  subject: string
  sender_name: string | null
  sender_email: string | null
  reply_to: string | null
  html_content: string
  recipient_filter: RecipientFilter
  status: CampaignStatus
  recipient_count: number
  sent_count: number
  failed_count: number
  scheduled_at: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
}

export interface CampaignInput {
  name: string
  subject: string
  sender_name: string | null
  sender_email: string | null
  reply_to: string | null
  html_content: string
  recipient_filter: RecipientFilter
  /** ISO timestamp. Set to schedule for later; null/undefined leaves it a draft. */
  scheduled_at?: string | null
}

export type CampaignSendStatus = 'sent' | 'failed'

export interface CampaignSend {
  id: string
  campaign_id: string
  subscriber_id: string | null
  email: string
  status: CampaignSendStatus
  error: string | null
  resend_id: string | null
  sent_at: string
  opened_at: string | null
  clicked_at: string | null
  open_count: number
  click_count: number
}
