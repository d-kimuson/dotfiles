#!/usr/bin/env bash

set -euo pipefail

PR_NUMBER="${1:-}"

if [ -z "$PR_NUMBER" ]; then
  echo "Error: PR number is required"
  echo "Usage: $0 <PR_NUMBER>"
  exit 1
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
  
  PENDING_COUNT=$(echo "$CHECK_STATUS" | jq '[.[] | select(.state == "PENDING" or .state == "IN_PROGRESS" or .state == "QUEUED")] | length')
  
  if [ "$PENDING_COUNT" -eq 0 ]; then
    TOTAL_COUNT=$(echo "$CHECK_STATUS" | jq 'length')
    SUCCESS_COUNT=$(echo "$CHECK_STATUS" | jq '[.[] | select(.state == "SUCCESS")] | length')
    FAILURE_COUNT=$(echo "$CHECK_STATUS" | jq '[.[] | select(.state == "FAILURE")] | length')
    
    echo "CI checks completed:"
    echo "  Total: $TOTAL_COUNT"
    echo "  Success: $SUCCESS_COUNT"
    echo "  Failure: $FAILURE_COUNT"
    echo ""
    
    if [ "$FAILURE_COUNT" -gt 0 ]; then
      echo "Failed checks:"
      FAILED_CHECKS=$(echo "$CHECK_STATUS" | jq -r '.[] | select(.state == "FAILURE")')
      
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
