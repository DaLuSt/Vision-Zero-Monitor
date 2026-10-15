#!/usr/bin/env bash
# Open, update or close the GitHub issue that tracks a failing data refresh.
#
# Called by the `alert` job in .github/workflows/update-data.yml. Inputs come from
# environment variables only (never interpolated into the script), because the
# pipeline message can contain text from external sources.
#
#   UPDATE_RESULT  result of the update job   (success|failure|cancelled|skipped)
#   DEPLOY_RESULT  result of the deploy job   (success|failure|cancelled|skipped)
#   OUTCOME        statistics pipeline outcome (success|unchanged|failure|"")
#   LEGISLATION_OUTCOME  legislation register outcome (success|unchanged|failure|"")
#   MESSAGE        last pipeline status message (single line, may be empty)
#   RUN_URL        link to the workflow run
#   GH_TOKEN, GH_REPO  used by the gh CLI
set -euo pipefail

LABEL="data-refresh-failure"
TITLE="Weekly data refresh is failing"

existing=$(gh issue list --label "$LABEL" --state open --json number --jq '.[0].number // empty')

failed=false
if [ "${UPDATE_RESULT:-}" = "failure" ] || [ "${DEPLOY_RESULT:-}" = "failure" ]; then
  failed=true
fi

if [ "$failed" = true ]; then
  body=$(mktemp)
  {
    echo "The **Update data** workflow failed on $(date -u +%Y-%m-%d) at $(date -u +%H:%M) UTC."
    echo
    echo "- Run: ${RUN_URL}"
    echo "- Statistics pipeline outcome: \`${OUTCOME:-not reported}\`"
    echo "- Legislation register outcome: \`${LEGISLATION_OUTCOME:-not reported}\`"
    echo "- Update job: \`${UPDATE_RESULT:-unknown}\` · Deploy job: \`${DEPLOY_RESULT:-unknown}\`"
    if [ -n "${MESSAGE:-}" ]; then
      echo "- Last pipeline status message:"
      echo
      echo '  ```'
      echo "  ${MESSAGE}"
      echo '  ```'
    fi
    echo
    echo "The public site keeps showing the last validated dataset. Raw source responses (if"
    echo "retrieved) are attached to the run as an artifact. This issue closes automatically"
    echo "after the next successful run."
  } > "$body"

  if [ -n "$existing" ]; then
    gh issue comment "$existing" --body-file "$body"
    echo "Commented on existing alert issue #$existing"
  else
    gh label create "$LABEL" --color B60205 \
      --description "Automated: the scheduled data refresh failed" --force >/dev/null
    gh issue create --title "$TITLE" --label "$LABEL" --body-file "$body"
  fi
  rm -f "$body"
elif [ -n "$existing" ] && [ "${UPDATE_RESULT:-}" = "success" ]; then
  gh issue close "$existing" --comment "Resolved: the data refresh succeeded (outcome \`${OUTCOME:-unknown}\`) in ${RUN_URL}"
  echo "Closed alert issue #$existing"
else
  echo "No alert action needed (update=${UPDATE_RESULT:-}, deploy=${DEPLOY_RESULT:-}, open issue=${existing:-none})."
fi
