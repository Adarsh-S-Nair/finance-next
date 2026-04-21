# -----------------------------------------------------------------------------
# zervo.app — DNS records served by Vercel DNS
# -----------------------------------------------------------------------------
#
# The domain is registered with Namecheap but its nameservers point at Vercel,
# so every record below becomes a single source of truth. To add a new
# subdomain, just add a resource block and `terraform apply`.
#
# Imports (one-time, when records were first mirrored in from Namecheap):
#   terraform import vercel_dns_record.apex_a      rec_xxx
#   terraform import vercel_dns_record.www_cname   rec_xxx
#   ...and so on.
# -----------------------------------------------------------------------------

locals {
  domain = "zervo.app"
}

# Apex A record → Vercel's Anycast IP. Anything else would break app routing.
resource "vercel_dns_record" "apex_a" {
  domain = local.domain
  name   = ""
  type   = "A"
  value  = "216.198.79.1"
  ttl    = 60
}

# www → redirects to apex (the redirect itself lives on the Vercel project).
resource "vercel_dns_record" "www_cname" {
  domain = local.domain
  name   = "www"
  type   = "CNAME"
  value  = "cname.vercel-dns.com"
  ttl    = 60
}

# Admin dashboard
resource "vercel_dns_record" "admin_cname" {
  domain = local.domain
  name   = "admin"
  type   = "CNAME"
  value  = "cname.vercel-dns.com"
  ttl    = 60
}

# -----------------------------------------------------------------------------
# Email — Namecheap's free email forwarding (contact@zervo.app, etc)
# Kept as-is so existing forwarding continues to work after the nameserver
# switch. If email ever moves (e.g. to Google Workspace), update these.
# -----------------------------------------------------------------------------

resource "vercel_dns_record" "mx_1" {
  domain    = local.domain
  name      = ""
  type      = "MX"
  value     = "eforward1.registrar-servers.com"
  mx_priority = 10
  ttl       = 1800
}

resource "vercel_dns_record" "mx_2" {
  domain    = local.domain
  name      = ""
  type      = "MX"
  value     = "eforward2.registrar-servers.com"
  mx_priority = 10
  ttl       = 1800
}

resource "vercel_dns_record" "mx_3" {
  domain    = local.domain
  name      = ""
  type      = "MX"
  value     = "eforward3.registrar-servers.com"
  mx_priority = 10
  ttl       = 1800
}

resource "vercel_dns_record" "mx_4" {
  domain      = local.domain
  name        = ""
  type        = "MX"
  value       = "eforward4.registrar-servers.com"
  mx_priority = 15
  ttl         = 1800
}

resource "vercel_dns_record" "mx_5" {
  domain      = local.domain
  name        = ""
  type        = "MX"
  value       = "eforward5.registrar-servers.com"
  mx_priority = 20
  ttl         = 1800
}

resource "vercel_dns_record" "spf_txt" {
  domain = local.domain
  name   = ""
  type   = "TXT"
  value  = "v=spf1 include:spf.efwd.registrar-servers.com ~all"
  ttl    = 1800
}
