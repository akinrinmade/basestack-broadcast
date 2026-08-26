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
