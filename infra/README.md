# infra/ — Terraform for Vercel + DNS

Declarative state for everything on Vercel: both projects, their env vars and
domains, and every DNS record on `zervo.app`.

## Before you start

Day-to-day changes need **nothing installed** — you edit a `.tf` file and merge,
and Terraform Cloud applies it (see "State & CI"). Install Terraform locally
only if you want to run `terraform plan` previews:

```bash
winget install Hashicorp.Terraform   # Windows
brew install terraform                # macOS
```

Secrets (the Vercel token, Supabase keys, etc.) live as **workspace variables
in Terraform Cloud**, not in a local file — there's no `terraform.tfvars` to
fill in anymore. The `terraform.tfvars.example` is kept only as a record of
which variables the workspace needs.

## Day-to-day

Edit the relevant `*.tf` file, open a PR (Terraform Cloud posts a speculative
`plan` as a status check), and **merge to `main`** — the apply runs
automatically. To preview locally before pushing:

```bash
cd infra
terraform login   # once, to authenticate the cloud workspace
terraform plan    # runs against the remote workspace
```

Add a new subdomain? Add a resource block to `dns.tf` and **merge to `main`** —
Terraform Cloud plans and applies automatically (see "State & CI" below).
Change an env var? Edit `vercel.tf`, merge. Use `terraform plan` locally first
if you want to preview.

## State & CI

State and runs live in **Terraform Cloud** (HCP Terraform), workspace
`zervo/infra`, configured via the `cloud {}` block in `main.tf`. The GitHub
repo is connected to that workspace over VCS with **auto-apply on**, so any
merge to `main` that touches `infra/**` automatically plans and applies — no
local `terraform apply` needed. PRs get a speculative plan as a status check.

`terraform.tfstate` is no longer used locally (the old local state was migrated
in during bootstrap). You can still run `terraform plan` locally for previews;
it talks to the same remote workspace.

### First-time bootstrap (one-time, done once per environment)

1. Create a free Terraform Cloud account at https://app.terraform.io and an
   **organization** named `zervo` (if that org name is taken, pick another and
   update `organization` in `main.tf`). Create a **workspace** named `infra`.
2. In the workspace, set these as **sensitive Terraform variables** (same
   values as the old `terraform.tfvars`): `vercel_api_token`, `vercel_team_id`,
   `supabase_url`, `supabase_anon_key`, `supabase_service_role_key`.
3. Migrate the existing local state into the workspace from the machine that
   still has `terraform.tfstate`:
   ```bash
   cd infra
   terraform login            # creates an API token for the cloud block
   terraform init -migrate-state   # answer "yes" to copy local state up
   ```
   This seeds the workspace with all already-imported resources so the first
   remote run is a no-op, not a "recreate everything" disaster.
4. Connect the workspace to this GitHub repo (Workspace → Settings → Version
   Control): set **Terraform Working Directory** to `infra`, and turn on
   **Auto apply**. Optionally restrict triggers to the `infra/` path.
5. Merge a trivial infra change to confirm the run fires and applies.

After step 5, the workflow you wanted is live: edit `*.tf` → open PR (see the
plan) → merge → auto-applied.

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
