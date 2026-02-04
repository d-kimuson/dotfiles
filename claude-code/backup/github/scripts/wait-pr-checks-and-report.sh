#!/usr/bin/env bash

set -euo pipefail

PR_NUMBER=""
IGNORE_WORKFLOWS=()

usage() {
  echo "Usage: $0 <PR_NUMBER> [--ignore <workflow_name>]..."
  echo ""
  echo "Options:"
  echo "  --ignore, -i <name>  Ignore workflow by name (can be specified multiple times)"
  echo ""
  echo "Example:"
  echo "  $0 123 --ignore 'Visual Regression' --ignore 'Manual Approval'"
}

while [[ $# -gt 0 ]]; do
  case $1 in
    --ignore|-i)
      IGNORE_WORKFLOWS+=("$2")
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [ -z "$PR_NUMBER" ]; then
        PR_NUMBER="$1"
      else
        echo "Error: Unknown argument: $1"
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [ -z "$PR_NUMBER" ]; then
  echo "Error: PR number is required"
  usage
  exit 1
fi

# Build jq filter for ignored workflows
IGNORE_FILTER=""
if [ ${#IGNORE_WORKFLOWS[@]} -gt 0 ]; then
  IGNORE_NAMES=$(printf '%s\n' "${IGNORE_WORKFLOWS[@]}" | jq -R . | jq -s .)
  IGNORE_FILTER="| select(.name as \$n | $IGNORE_NAMES | index(\$n) | not)"
fi

POLL_INTERVAL=10
MAX_WAIT_TIME=3600
ELAPSED_TIME=0

while [ $ELAPSED_TIME -lt $MAX_WAIT_TIME ]; do
  CHECK_STATUS=$(gh pr checks "$PR_NUMBER" --json state,name,link 2>/dev/null || echo "[]")
  
  if [ "$CHECK_STATUS" = "[]" ]; then
    sleep $POLL_INTERVAL
    ELAPSED_TIME=$((ELAPSED_TIME + POLL_INTERVAL))
    continue
  fi
  
  # Apply ignore filter to get relevant checks only
  RELEVANT_CHECKS=$(echo "$CHECK_STATUS" | jq "[.[] $IGNORE_FILTER]")

  PENDING_COUNT=$(echo "$RELEVANT_CHECKS" | jq '[.[] | select(.state == "PENDING" or .state == "IN_PROGRESS" or .state == "QUEUED")] | length')

  if [ "$PENDING_COUNT" -eq 0 ]; then
    TOTAL_COUNT=$(echo "$RELEVANT_CHECKS" | jq 'length')
    SUCCESS_COUNT=$(echo "$RELEVANT_CHECKS" | jq '[.[] | select(.state == "SUCCESS")] | length')
    FAILURE_COUNT=$(echo "$RELEVANT_CHECKS" | jq '[.[] | select(.state == "FAILURE")] | length')
    IGNORED_COUNT=$(echo "$CHECK_STATUS" | jq "length - $(echo "$RELEVANT_CHECKS" | jq 'length')")
    
    echo "CI checks completed:"
    echo "  Total: $TOTAL_COUNT"
    echo "  Success: $SUCCESS_COUNT"
    echo "  Failure: $FAILURE_COUNT"
    if [ "$IGNORED_COUNT" -gt 0 ]; then
      echo "  Ignored: $IGNORED_COUNT"
    fi
    echo ""
    
    if [ "$FAILURE_COUNT" -gt 0 ]; then
      echo "Failed checks:"
      FAILED_CHECKS=$(echo "$RELEVANT_CHECKS" | jq -r '.[] | select(.state == "FAILURE")')
      
      echo "$FAILED_CHECKS" | jq -r '"  - \(.name)"'
      echo ""
      
      echo "Failed logs:"
      echo "$FAILED_CHECKS" | jq -r '.link' | while read -r link; do
        if [[ "$link" =~ /runs/([0-9]+) ]]; then
          RUN_ID="${BASH_REMATCH[1]}"
          echo ""
          echo "=== Run ID: $RUN_ID ==="
          gh run view "$RUN_ID" --log-failed 2>&1 || echo "Failed to fetch logs for run $RUN_ID"
        fi
      done
      
      exit 1
    else
      echo "All checks passed!"
      exit 0
    fi
  fi
  
  sleep $POLL_INTERVAL
  ELAPSED_TIME=$((ELAPSED_TIME + POLL_INTERVAL))
done

echo "Timeout: CI checks did not complete within ${MAX_WAIT_TIME} seconds"
exit 1
