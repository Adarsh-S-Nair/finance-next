# infra/ — Terraform for Vercel + DNS

Declarative state for everything on Vercel: both projects, their env vars and
domains, and every DNS record on `zervo.app`.

## Before you start

Install Terraform (once, on the machine running `terraform apply`):

```bash
winget install Hashicorp.Terraform   # Windows
brew install terraform                # macOS
```

Get a Vercel API token at https://vercel.com/account/tokens, then copy the
template and fill in the secrets:

```bash
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars (gitignored) and paste the real values
```

## Day-to-day

```bash
cd infra
terraform plan    # see what will change
terraform apply   # roll it out
```

Add a new subdomain? Add a resource block to `dns.tf`, `terraform apply`.
Change an env var? Edit `vercel.tf`, `terraform apply`.

## State

State lives locally in `terraform.tfstate` (gitignored). If you lose it,
you can re-import every resource — see the comments in `vercel.tf` and
`dns.tf` for the import commands used originally.

If the state starts to hurt (team access, fear of loss, etc.), migrate
to Terraform Cloud with:

```hcl
# in main.tf
backend "remote" {
  organization = "zervo"
  workspaces { name = "infra" }
}
```

...then `terraform init -migrate-state` and commit.

## One-time manual steps that don't live in code

- **Google OAuth consent screen** — configured once in Google Cloud Console.
- **Supabase Auth providers** — Google provider enabled in the Supabase
  dashboard. Redirect URLs for admin should include
  `https://admin.zervo.app/auth/callback`.
- **Namecheap nameservers** — set to `ns1.vercel-dns.com` and
  `ns2.vercel-dns.com`. The only reason to log back into Namecheap after
  this is the annual domain renewal.

## First-time bootstrap (already done, recorded for the archive)

Both Vercel projects and the DNS zone already exist. To reproduce the state
that Terraform now owns, these imports were run once:

```bash
terraform import vercel_project.finance prj_VoG2H8XSP6MAd8TvkcixeRifLTq4
terraform import vercel_project.admin   prj_0iPC1CHOb7puvOWTunkvRIAo242R

terraform import vercel_project_domain.finance_apex    zervo.app
terraform import vercel_project_domain.finance_www     www.zervo.app
terraform import vercel_project_domain.admin_subdomain admin.zervo.app

# DNS records — IDs are in the Vercel dashboard / API response
terraform import vercel_dns_record.apex_a  <rec_id>
terraform import vercel_dns_record.www_cname <rec_id>
# ...etc
```
