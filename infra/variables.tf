variable "vercel_api_token" {
  description = "Vercel API token (https://vercel.com/account/tokens)"
  type        = string
  sensitive   = true
}

variable "vercel_team_id" {
  description = "Vercel team ID (team_HlkHqpZOKsamypCa0L3G5Ird)"
  type        = string
  default     = "team_HlkHqpZOKsamypCa0L3G5Ird"
}

variable "github_repo" {
  description = "GitHub repo in <owner>/<name> form"
  type        = string
  default     = "Adarsh-S-Nair/finance-next"
}

variable "admin_emails" {
  description = "Comma-separated allowlist of emails permitted to access apps/admin"
  type        = string
  default     = "asnair159@gmail.com"
}

variable "supabase_url" {
  description = "Supabase project URL — shared by apps/finance and apps/admin"
  type        = string
  sensitive   = true
}

variable "supabase_anon_key" {
  description = "Supabase anon key — shared"
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Supabase service-role key — shared, server-side only"
  type        = string
  sensitive   = true
}

variable "finance_api_url" {
  description = "Origin of the finance app. apps/admin proxies privileged actions (user delete, subscription changes) here so Plaid /item/remove and Stripe cleanup run in finance's environment instead of duplicating SDKs in admin."
  type        = string
  default     = "https://zervo.app"
}
