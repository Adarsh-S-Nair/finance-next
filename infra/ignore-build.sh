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
  # Preview deploy. Fetch main if we don't have it (Vercel does a shallow clone).
  git fetch origin main --depth=50 --quiet 2>/dev/null || true
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    BASE="origin/main"
  elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    BASE="HEAD~1"
  else
    echo "[ignore-build] can't find a base to diff against — building"
    exit 1
  fi
  echo "[ignore-build] comparing against: $BASE"
fi

# shellcheck disable=SC2086
if git diff --quiet "$BASE" HEAD -- $PATHS; then
  echo "[ignore-build] no changes in: $PATHS — skipping"
  exit 0
else
  echo "[ignore-build] changes detected in: $PATHS — building"
  exit 1
fi
