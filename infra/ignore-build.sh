#!/usr/bin/env bash
# Vercel "Ignored Build Step" for our pnpm workspace monorepo.
#
# Usage: bash infra/ignore-build.sh <app> <path1> [path2 ...]
#   e.g. bash infra/ignore-build.sh finance apps/finance packages pnpm-lock.yaml pnpm-workspace.yaml package.json
#
# Vercel's convention: exit 0 = SKIP the build, exit 1 = PROCEED.
# Anything else = treated as proceed (safe default).
#
# How it picks the diff base:
#   - Production deploys (branch = main): VERCEL_GIT_PREVIOUS_SHA is the
#     last-successful-production SHA. Compare against that.
#   - Preview deploys (any other branch): compare against origin/main's tip,
#     which is what actually matters for "should this PR trigger a build?".
#
# First-ever deploy (no previous SHA, no main remote yet) = always build.

set -e

APP_LABEL="$1"
shift || true

if [ -z "$APP_LABEL" ] || [ $# -eq 0 ]; then
  echo "usage: ignore-build.sh <app> <paths...>"
  exit 1  # proceed on misuse
fi

PATHS="$@"

echo "[ignore-build] app=$APP_LABEL env=${VERCEL_ENV:-unknown} sha=${VERCEL_GIT_COMMIT_SHA:0:8}"

if [ "$VERCEL_ENV" = "production" ]; then
  BASE="${VERCEL_GIT_PREVIOUS_SHA}"
  if [ -z "$BASE" ]; then
    echo "[ignore-build] no previous production SHA, first deploy — building"
    exit 1
  fi
  echo "[ignore-build] comparing against previous prod SHA: ${BASE:0:8}"
else
  # Preview deploy. We need to compare against main's tip — NOT HEAD~1, because
  # the current commit might be mid-PR and HEAD~1 would only show the last
  # commit's diff, not the whole PR's diff vs main. If we can't reach main
  # for any reason, fail-open (build) — a correct build is always safer than
  # an incorrect skip.
  echo "[ignore-build] fetching origin/main..."
  git fetch origin main --depth=100 2>&1 | head -3 || true
  if ! git rev-parse --verify origin/main >/dev/null 2>&1; then
    echo "[ignore-build] origin/main not available after fetch — fail-open, building"
    exit 1
  fi
  BASE="origin/main"
  echo "[ignore-build] comparing against: $BASE (${BASE:0:8})"
fi

# shellcheck disable=SC2086
if git diff --quiet "$BASE" HEAD -- $PATHS; then
  echo "[ignore-build] no changes in: $PATHS — skipping"
  exit 0
else
  echo "[ignore-build] changes detected in: $PATHS — building"
  exit 1
fi
