#!/usr/bin/env bash
#
# Smoke test for the Polaris CRM MCP endpoint (/api/mcp).
#
# Runs the MCP `initialize` handshake against a deployment and checks the
# response. This exercises the whole chain end to end: the MCP_ENABLED gate,
# per-IP rate limit, bearer-token auth (a real api_keys lookup), and the
# Streamable HTTP transport.
#
# Usage:
#   scripts/mcp-smoke.sh <domain> <api-key>
#   MCP_DOMAIN=https://app.example.com MCP_KEY=pcrm_... scripts/mcp-smoke.sh
#
# Notes:
#   - The api-key is a live secret; prefer the env-var form and keep it out of
#     your shell history (e.g. `read -rs MCP_KEY`).
#   - Requires curl. Works in Git Bash on Windows.
#
set -euo pipefail

DOMAIN="${1:-${MCP_DOMAIN:-}}"
KEY="${2:-${MCP_KEY:-}}"

if [[ -z "$DOMAIN" || -z "$KEY" ]]; then
  echo "usage: $0 <domain> <api-key>   (or set MCP_DOMAIN / MCP_KEY)" >&2
  exit 2
fi

# Normalise: strip a trailing slash so we don't produce "//api/mcp".
ENDPOINT="${DOMAIN%/}/api/mcp"

INIT_BODY='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}'

echo "→ POST $ENDPOINT (initialize)"

# Capture body and HTTP status separately; -sS keeps it quiet but shows errors.
response="$(
  curl -sS -o - -w $'\n__HTTP_STATUS__%{http_code}' \
    --max-time 30 \
    -H "authorization: Bearer $KEY" \
    -H "content-type: application/json" \
    -H "accept: application/json, text/event-stream" \
    -d "$INIT_BODY" \
    "$ENDPOINT"
)"

status="${response##*__HTTP_STATUS__}"
body="${response%$'\n'__HTTP_STATUS__*}"

echo "← HTTP $status"

case "$status" in
  200)
    if grep -q '"result"' <<<"$body"; then
      echo "✓ PASS — MCP endpoint is live and the key authenticated."
      # Pull out the SSE `data:` frame if present, else print the body.
      grep '^data:' <<<"$body" | sed 's/^data: //' || echo "$body"
      exit 0
    fi
    echo "✗ 200 but no JSON-RPC result in the body:" >&2
    echo "$body" >&2
    exit 1
    ;;
  401) echo "✗ FAIL — 401 Unauthorized: key is wrong, revoked, expired, or the owner is deactivated." >&2 ;;
  404) echo "✗ FAIL — 404: MCP_ENABLED is not 'true' on this deployment (or not redeployed since)." >&2 ;;
  429) echo "✗ FAIL — 429: rate limited (per-IP). Wait and retry." >&2 ;;
  503) echo "✗ FAIL — 503: MCP enabled in production but Upstash (rate limiting) is not configured." >&2 ;;
  *)   echo "✗ FAIL — unexpected status $status:" >&2; echo "$body" >&2 ;;
esac
exit 1
