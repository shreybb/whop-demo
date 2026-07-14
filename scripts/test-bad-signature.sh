#!/usr/bin/env bash
# Spec testing checklist #1: garbage signature -> 401 + a logged row with
# signature_valid=false. Point URL at your local dev server or deployment.
#
#   ./scripts/test-bad-signature.sh http://localhost:3000
set -euo pipefail
BASE="${1:-http://localhost:3000}"
URL="$BASE/api/webhooks/whop"

echo "POST $URL with an invalid signature…"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST "$URL" \
  -H "content-type: application/json" \
  -H "webhook-id: evt_bad_$(date +%s)" \
  -H "webhook-signature: v1,not-a-real-signature" \
  -H "webhook-timestamp: $(date +%s)" \
  -d '{"action":"payment.succeeded","data":{"id":"pay_fake","final_amount":10,"currency":"usd","metadata":{"order_id":"x"}}}'

echo "Expected: HTTP 401, and a webhook_events row with signature_valid=false."
