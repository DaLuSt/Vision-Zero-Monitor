#!/usr/bin/env bash
# Open, update or close the issue that tracks commitment quotes that no longer match their
# official source documents. Called by .github/workflows/verify-commitments.yml.
#
#   $1         the verifier's log (lines starting with OK / MISSING / ERROR)
#   FAILED     "true" when the verifier failed (after its retry)
#   RUN_URL    link to the workflow run
#   GH_TOKEN, GH_REPO  used by the gh CLI
#
# Inputs come from files and environment variables only, never interpolated into the script.
set -euo pipefail

LOG="${1:?usage: quote-alert.sh LOG}"
LABEL="commitment-source-check"
TITLE="A commitment quote no longer matches its official source"

existing=$(gh issue list --label "$LABEL" --state open --json number --jq '.[0].number // empty')

if [ "${FAILED:-}" = "true" ]; then
  body=$(mktemp)
  {
    echo "The monthly check on $(date -u +%Y-%m-%d) found commitment quotes that could not be matched"
    echo "word for word in their official documents."
    echo
    echo "- Run: ${RUN_URL}"
    echo
    echo '```'
    grep -E '^(MISSING|ERROR)' "$LOG" | cut -c1-300 | head -n 30 || true
    echo '```'
    echo
    echo "**What to do:** open each document, check whether the text moved or changed, update"
    echo "\`data/curated/commitments.json\` if needed, re-run \`python -m scripts.commitments.verify_sources\`"
    echo "and record the review date in \`reviewed_at\`. An \`ERROR\` line usually means the site was"
    echo "unreachable or moved the document. This issue closes after the next check that finds every quote."
  } > "$body"
  if [ -n "$existing" ]; then
    gh issue comment "$existing" --body-file "$body"
  else
    gh label create "$LABEL" --color D93F0B \
      --description "Automated: a curated commitment no longer matches its source" --force >/dev/null
    gh issue create --title "$TITLE" --label "$LABEL" --body-file "$body"
  fi
  rm -f "$body"
elif [ -n "$existing" ]; then
  gh issue close "$existing" --comment "Resolved: every commitment quote matched its source again in ${RUN_URL}"
else
  echo "All quotes match; no alert issue open."
fi
