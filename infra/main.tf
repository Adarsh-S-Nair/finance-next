terraform {
  required_version = ">= 1.9.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.0"
    }
  }

  # Local state. If state grows to matter, migrate to Terraform Cloud with:
  #   backend "remote" { ... }
  # and run `terraform init -migrate-state`.
}

provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id
}
