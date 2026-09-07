# Short Studio public information site

Public homepage, privacy policy and terms for The Unquiet Chapter's private production app.
Production URL: https://studio.zervo.app

This dependency-free static site is isolated from the finance applications: no shared
packages, environment variables, database clients, login, private server calls or analytics.
Only the six files under `public/` are published. Vercel configuration adds clean routes
and security headers. Contact and policy descriptions must stay in sync with actual app behavior.

## Verify and preview

Run `node verify.mjs` in this directory, then `node preview.mjs`.
The local preview listens on http://127.0.0.1:4325. It is a local development server only.

## Deployment

A separate Vercel project, project domain, DNS CNAME and initial production deployment
are managed in `infra/studio.tf`. Commits touching this directory deploy through the
existing GitHub/Vercel integration once the project exists.

Terraform Cloud workspace `zervo/infra` was checked on 2026-09-06: remote execution,
no VCS repository connection, auto-apply disabled. A Git push alone does not apply IaC.
Use the CLI-driven remote plan/apply workflow in `infra/README.md`.

The public pages are not a claim of Google OAuth verification or YouTube API audit
approval. Before submitting an audit, independently verify the private application's
retention, deletion, authorization and API-policy compliance.

