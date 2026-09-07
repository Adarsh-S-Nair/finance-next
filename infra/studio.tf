# Public information only. No finance environment variables or private studio API.
resource "vercel_project" "studio_info" {
  name             = "short-studio-info"
  root_directory   = "apps/studio-info"
  install_command  = "node --version"
  build_command    = "node verify.mjs"
  output_directory = "public"

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = "main"
  }

  ignore_command = "cd ../.. && bash infra/ignore-build.sh studio-info apps/studio-info"

  vercel_authentication = {
    deployment_type = "standard_protection_new"
  }
}

resource "vercel_project_domain" "studio_info" {
  project_id = vercel_project.studio_info.id
  domain     = "studio.${local.domain}"
}

resource "vercel_dns_record" "studio_cname" {
  domain = local.domain
  name   = "studio"
  type   = "CNAME"
  value  = "cname.vercel-dns.com"
  ttl    = 60
}

# Seeds the first production deployment. Subsequent app commits deploy via Git.
resource "vercel_deployment" "studio_info_initial" {
  project_id = vercel_project.studio_info.id
  ref        = "main"
  production = true
  depends_on = [vercel_project_domain.studio_info, vercel_dns_record.studio_cname]
}

