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

resource "vercel_project" "finance" {
  name      = "zentari-next"
  framework = "nextjs"

  root_directory = "apps/finance"
  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = "main"
  }

  # Preview deploys require the Vercel login password (doesn't affect prod).
  vercel_authentication = {
    deployment_type = "standard_protection_new"
  }
}

resource "vercel_project" "admin" {
  name      = "zervo-admin"
  framework = "nextjs"

  root_directory = "apps/admin"
  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = "main"
  }

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
