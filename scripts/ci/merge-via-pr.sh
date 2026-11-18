#!/usr/bin/env bash
# Get a commit made by a workflow into main through a pull request, as the
# protect-main ruleset requires (a PR plus the three CI checks; GITHUB_TOKEN cannot
# be a bypass actor).
#
# Pushes HEAD to a new branch, starts CI on it, opens a pull request, waits for CI
# and merges the pull request once every check has passed. A push or pull request
# made with GITHUB_TOKEN triggers no workflow, so CI is started with
# workflow_dispatch, which is allowed; its jobs report the required check names on
# the branch head. If CI fails, the pull request is left open and the script exits 1.
#
# Called by update-data.yml and release.yml. Inputs come from environment variables
# only (never interpolated into the script):
#
#   BRANCH     name of the branch to create, e.g. data/refresh-123456789
#   PR_TITLE   pull request title
#   PR_BODY    pull request body
#   GH_TOKEN   token for the gh CLI (needs contents, pull-requests and actions: write)
#
# Writes merge_sha=<sha of the merge commit on main> to $GITHUB_OUTPUT.
set -euo pipefail

sha=$(git rev-parse HEAD)
git push origin "HEAD:refs/heads/$BRANCH"

gh workflow run ci.yml --ref "$BRANCH"
run_id=""
for _ in $(seq 1 30); do
  run_id=$(gh run list --workflow ci.yml --branch "$BRANCH" --event workflow_dispatch \
    --json databaseId,headSha --jq "map(select(.headSha == \"$sha\")) | .[0].databaseId // empty")
  [ -n "$run_id" ] && break
  sleep 10
done
if [ -z "$run_id" ]; then
  echo "::error::CI did not start on $BRANCH"
  exit 1
fi

pr_url=$(gh pr create --base main --head "$BRANCH" --title "$PR_TITLE" --body "$PR_BODY")
echo "Opened $pr_url; waiting for CI run $run_id"

if ! gh run watch "$run_id" --exit-status --interval 30; then
  echo "::error::CI failed on $BRANCH; the pull request is left open: $pr_url"
  exit 1
fi

# --match-head-commit: merge only the commit CI has just tested. GitHub can take a
# moment to count the finished checks, so a refused merge is retried a few times. The
# branch is deleted by the repository setting "Automatically delete head branches".
for attempt in 1 2 3 4 5; do
  if gh pr merge "$pr_url" --merge --match-head-commit "$sha"; then
    break
  fi
  if [ "$attempt" = 5 ]; then
    echo "::error::Could not merge $pr_url; it is left open"
    exit 1
  fi
  sleep 20
done
merge_sha=$(gh pr view "$pr_url" --json mergeCommit --jq '.mergeCommit.oid')
echo "Merged $pr_url as $merge_sha"
echo "merge_sha=$merge_sha" >> "$GITHUB_OUTPUT"
