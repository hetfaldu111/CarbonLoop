#!/usr/bin/env bash
# End-to-end smoke test against a running backend (default http://localhost:8080).
# Usage: bash scripts/smoke.sh [base-url]
# Exercises the full happy path across every role. Prints PASS/FAIL per step.

BASE="${1:-http://localhost:8080}"
PASS=0
FAIL=0

c() { # c <jq-free grep pattern> <label> <curl args...>
  local pattern="$1"; local label="$2"; shift 2
  local out
  out="$(curl -s "$@")"
  if echo "$out" | grep -q "$pattern"; then
    echo "  PASS  $label"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $label"
    echo "        expected to match: $pattern"
    echo "        got: $(echo "$out" | head -c 400)"
    FAIL=$((FAIL+1))
  fi
}

login() { # login <email> -> token on stdout
  curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"Password123!\"}" \
    | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p'
}

field() { # field <json> <key> -> first value
  echo "$1" | sed -n "s/.*\"$2\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -1
}

echo "== Public endpoints (no auth) =="
c 'totalCo2DivertedTonnes' 'GET /api/public/impact' "$BASE/api/public/impact"
c '\[' 'GET /api/public/listings' "$BASE/api/public/listings"

echo
echo "== Login for every role =="
ADMIN=$(login admin@carbon.local)
CEMENT=$(login cement@carbon.local)
POWER=$(login power@carbon.local)
METHANOL=$(login methanol@carbon.local)
ALGAE=$(login algae@carbon.local)
LAB=$(login lab@carbon.local)
REG=$(login regulator@carbon.local)
TRANS=$(login odtrans@carbon.local)
for pair in "ADMIN:$ADMIN" "CEMENT:$CEMENT" "POWER:$POWER" "METHANOL:$METHANOL" "ALGAE:$ALGAE" "LAB:$LAB" "REG:$REG" "TRANS:$TRANS"; do
  name="${pair%%:*}"; tok="${pair#*:}"
  if [ -n "$tok" ]; then echo "  PASS  login $name"; PASS=$((PASS+1));
  else echo "  FAIL  login $name"; FAIL=$((FAIL+1)); fi
done

AUTH_ADMIN=(-H "Authorization: Bearer $ADMIN")
AUTH_CEMENT=(-H "Authorization: Bearer $CEMENT")
AUTH_METH=(-H "Authorization: Bearer $METHANOL")
AUTH_LAB=(-H "Authorization: Bearer $LAB")
AUTH_REG=(-H "Authorization: Bearer $REG")
AUTH_TRANS=(-H "Authorization: Bearer $TRANS")

echo
echo "== Pending-approval account must not log in =="
# Register a throwaway company rather than relying on the seeded newco@carbon.local,
# whose status legitimately changes as soon as anyone runs the admin approval demo.
PENDING_EMAIL="smoke-pending-$$-$(date +%s)@carbon.local"
curl -s -o /dev/null -X POST "$BASE/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"role\":\"UTILIZER\",\"companyName\":\"Smoke Pending $$\",\"email\":\"$PENDING_EMAIL\",\"password\":\"Password123!\",\"fullName\":\"Smoke Test\",\"contactPhone\":\"9000000000\",\"address\":\"1 Test Rd\",\"city\":\"Surat\",\"state\":\"Gujarat\",\"country\":\"India\",\"latitude\":21.17,\"longitude\":72.83,\"sector\":\"ALGAE\",\"registrationNumber\":\"SMOKE-$$\",\"roleProfile\":{}}"
c 'pending\|403' 'a freshly registered company cannot log in before approval' -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$PENDING_EMAIL\",\"password\":\"Password123!\"}"

echo
echo "== Admin =="
c '"status"' 'GET /api/admin/companies?status=PENDING' "${AUTH_ADMIN[@]}" "$BASE/api/admin/companies?status=PENDING"
c 'hash' 'GET /api/audit' "${AUTH_ADMIN[@]}" "$BASE/api/audit?page=0&size=5"

echo
echo "== Emitter =="
PASSPORTS=$(curl -s "${AUTH_CEMENT[@]}" "$BASE/api/passports")
c 'CO2-IND-2026-000342' 'GET /api/passports lists seeded passport' "${AUTH_CEMENT[@]}" "$BASE/api/passports"
PID=$(echo "$PASSPORTS" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)"[^}]*CO2-IND-2026-000342.*/\1/p' | head -1)
[ -z "$PID" ] && PID=$(echo "$PASSPORTS" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
c 'freeTonnes' "GET /api/passports/$PID/allocation" "${AUTH_CEMENT[@]}" "$BASE/api/passports/$PID/allocation"
MINE=$(curl -s "${AUTH_CEMENT[@]}" "$BASE/api/listings/mine")
c 'TENDER' 'GET /api/listings/mine' "${AUTH_CEMENT[@]}" "$BASE/api/listings/mine"
LID=$(echo "$MINE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)
c 'scoreBreakdown' "GET /api/listings/$LID/proposals ranked with breakdown" "${AUTH_CEMENT[@]}" "$BASE/api/listings/$LID/proposals"
c 'recommendation\|Recommended' "proposals carry a recommendation" "${AUTH_CEMENT[@]}" "$BASE/api/listings/$LID/proposals"

echo
echo "== Utilizer =="
c 'volumeTonnes' 'GET /api/listings (marketplace)' "${AUTH_METH[@]}" "$BASE/api/listings"
c 'FORECAST_SHORTFALL' 'GET /api/notifications has the shortfall alert' "${AUTH_METH[@]}" "$BASE/api/notifications"
c 'netCarbonBenefitTonnes' 'POST /api/costs/estimate returns cost stack + carbon' -X POST "$BASE/api/costs/estimate" \
  "${AUTH_METH[@]}" -H 'Content-Type: application/json' \
  -d "{\"listingId\":\"$LID\",\"quantityTonnes\":100,\"requiredPurityPct\":98.5,\"transportMode\":\"TRUCK\",\"impurityLimits\":{\"SOx\":5}}"
c 'tier\|hiddenScore' 'GET /api/companies/me/trust' "${AUTH_METH[@]}" "$BASE/api/companies/me/trust"

echo
echo "== Lab =="
c 'priority\|PASSPORT_COA\|SALE_APPROVAL' 'GET /api/verification/queue' "${AUTH_LAB[@]}" "$BASE/api/verification/queue"

echo
echo "== Transport =="
c '\[' 'GET /api/shipments/offers' "${AUTH_TRANS[@]}" "$BASE/api/shipments/offers"

echo
echo "== Regulator =="
c 'byRegion' 'GET /api/regulator/overview' "${AUTH_REG[@]}" "$BASE/api/regulator/overview"
c 'incentiveFlags' 'GET /api/regulator/companies' "${AUTH_REG[@]}" "$BASE/api/regulator/companies"

echo
echo "== Meta =="
c 'weight\|TENDER\|rate' 'GET /api/meta/rates' "${AUTH_METH[@]}" "$BASE/api/meta/rates"

echo
echo "== Access control =="
c '403\|Forbidden\|Access Denied' 'utilizer cannot read the regulator overview' "${AUTH_METH[@]}" "$BASE/api/regulator/overview"
c '401\|403\|Unauthorized' 'no token is rejected on /api/listings' "$BASE/api/listings"

echo
echo "-----------------------------------------"
echo "PASS: $PASS   FAIL: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
