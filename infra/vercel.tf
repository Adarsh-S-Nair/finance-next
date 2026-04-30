# -----------------------------------------------------------------------------
# Vercel projects
# -----------------------------------------------------------------------------
#
# Both projects already exist in Vercel and are imported into this state — this
# file is the source of truth going forward. Future changes (env vars, root
# directory, etc) should be made here and rolled out via `terraform apply`.
#
# Import commands used to bring existing state in:
#   terraform import vercel_project.finance prj_VoG2H8XSP6MAd8TvkcixeRifLTq4
#   terraform import vercel_project.admin   prj_0iPC1CHOb7puvOWTunkvRIAo242R
# -----------------------------------------------------------------------------

# Only redeploy when files this app actually cares about changed. The script
# handles the production-vs-preview branching (compare against previous prod
# SHA vs origin/main tip), since a one-liner ignore_command can't do both
# cleanly. Exit 0 = skip, exit 1 = build.
locals {
  # Vercel runs the ignore command from the project's Root Directory
  # (apps/finance or apps/admin), so we have to cd up to the repo root first.
  finance_ignore = "cd ../.. && bash infra/ignore-build.sh finance apps/finance packages pnpm-lock.yaml pnpm-workspace.yaml package.json"
  admin_ignore   = "cd ../.. && bash infra/ignore-build.sh admin apps/admin packages pnpm-lock.yaml pnpm-workspace.yaml package.json"
}

resource "vercel_project" "finance" {
  name      = "finance-next"
  framework = "nextjs"

  root_directory = "apps/finance"
  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = "main"
  }

  # Skip builds when only unrelated apps changed (e.g. apps/admin-only commits).
  ignore_command = local.finance_ignore

  # Preview deploys require the Vercel login password (doesn't affect prod).
  vercel_authentication = {
    deployment_type = "standard_protection_new"
  }
}

resource "vercel_project" "admin" {
  name      = "finance-admin"
  framework = "nextjs"

  root_directory = "apps/admin"
  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = "main"
  }

  ignore_command = local.admin_ignore

  # Preview deploys require the Vercel login password (doesn't affect prod).
  vercel_authentication = {
    deployment_type = "standard_protection_new"
  }
}

# -----------------------------------------------------------------------------
# Admin env vars (finance env vars are managed in its own Vercel dashboard for
# now — adding them here would risk clobbering prod secrets during import).
# -----------------------------------------------------------------------------

resource "vercel_project_environment_variable" "admin_supabase_url" {
  project_id = vercel_project.admin.id
  key        = "NEXT_PUBLIC_SUPABASE_URL"
  value      = var.supabase_url
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "admin_supabase_anon_key" {
  project_id = vercel_project.admin.id
  key        = "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  value      = var.supabase_anon_key
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "admin_supabase_service_role_key" {
  project_id = vercel_project.admin.id
  key        = "SUPABASE_SERVICE_ROLE_KEY"
  value      = var.supabase_service_role_key
  sensitive  = true
  # Vercel disallows `development` for sensitive env vars.
  target     = ["production", "preview"]
}

resource "vercel_project_environment_variable" "admin_allowlist" {
  project_id = vercel_project.admin.id
  key        = "ADMIN_EMAILS"
  value      = var.admin_emails
  target     = ["production", "preview", "development"]
}

# Where apps/admin should send its proxied delete / subscription calls.
# The admin drawer never talks to Plaid or Stripe directly — it hands the
# action off to finance, which owns those SDKs.
resource "vercel_project_environment_variable" "admin_finance_api_url" {
  project_id = vercel_project.admin.id
  key        = "FINANCE_API_URL"
  value      = var.finance_api_url
  target     = ["production", "preview", "development"]
}

# -----------------------------------------------------------------------------
# Domain attachments (project ↔ host)
# -----------------------------------------------------------------------------

resource "vercel_project_domain" "finance_apex" {
  project_id = vercel_project.finance.id
  domain     = "zervo.app"
  redirect   = "www.zervo.app"
}

resource "vercel_project_domain" "finance_www" {
  project_id = vercel_project.finance.id
  domain     = "www.zervo.app"
}

resource "vercel_project_domain" "admin_subdomain" {
  project_id = vercel_project.admin.id
  domain     = "admin.zervo.app"
}

# support.zervo.app serves the *finance* app from a separate origin so
# impersonation sessions get their own localStorage scope. Same code,
# different host. The admin "Enter session" button constructs URLs at
# this host when the IMPERSONATION_HOST env var is set on the finance
# project (recommended value: https://support.zervo.app).
resource "vercel_project_domain" "finance_support" {
  project_id = vercel_project.finance.id
  domain     = "support.zervo.app"
}
