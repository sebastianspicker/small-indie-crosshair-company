#!/usr/bin/env bash
# Explicit user-run publication. Never used by tests/build or automatic background tasks.
set -euo pipefail
usage() { echo 'Usage: bash scripts/publish-github.sh OWNER/REPO --create-public'; echo 'Creates a NEW PUBLIC repository, pushes main/tags and enables GitHub Pages Actions.'; }
[[ $# == 2 && $2 == --create-public ]] || { usage; exit 2; }
repo=$1
[[ $repo =~ ^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$ ]] || { echo 'Use OWNER/REPO, not a URL.' >&2; exit 2; }
command -v gh >/dev/null || { echo 'Install the GitHub CLI and run gh auth login first.' >&2; exit 1; }
cd "$(dirname "$0")/.."
git rev-parse --is-inside-work-tree >/dev/null
gh auth status
[[ $(git branch --show-current) == main ]] || { echo 'Checkout main before publication.' >&2; exit 1; }
[[ -z $(git status --porcelain) ]] || { echo 'Commit local changes before publication.' >&2; exit 1; }
if git remote get-url origin >/dev/null 2>&1; then echo 'Existing origin found. Refusing to overwrite any remote. Follow docs/engineering/github-pages.md for an existing repository.' >&2; exit 1; fi
if gh repo view "$repo" >/dev/null 2>&1; then echo 'Repository already exists. Refusing to overwrite it.' >&2; exit 1; fi
npm run verify
# The literal flag is the user's explicit public-publication confirmation.
gh repo create "$repo" --public --description 'Four lines. One research department. Evidence-aware CS2 crosshair conversion.' --source . --remote origin
# Configure first: the initial main push should be able to run configure-pages.
gh api --method POST "repos/$repo/pages" -f build_type=workflow
git push -u origin main
git push origin --tags
echo "Publication requested. Inspect the Actions deployment; this script does not claim a live URL until it succeeds."
gh run list --repo "$repo" --workflow pages.yml --limit 3
