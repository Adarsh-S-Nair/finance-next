terraform {
  required_version = ">= 1.9.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.0"
    }
  }

  # State + runs live in Terraform Cloud (HCP Terraform). The repo is connected
  # to this workspace over VCS with auto-apply, so a merge to `main` that
  # touches infra/ automatically plans and applies. The block below also binds
  # the local CLI to the same workspace (used for the one-time state migration
  # and for `terraform plan` previews). First-time bootstrap + the exact
  # org/workspace setup live in infra/README.md -> "State & CI".
  cloud {
    organization = "zervo"

    workspaces {
      name = "infra"
    }
  }
}

provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id
}
