#!/usr/bin/env bash
#
# check-file-size.sh — Enforce a "ratchet" on source file line counts.
#
# Rules:
#   - Default thresholds:
#       .ts / .tsx  → 500 lines
#       .rs         → 800 lines
#   - Files listed in scripts/file-size-budgets.txt have their max frozen at a
#     grandfathered value; they may not grow past that.
#   - Any file exceeding its budget is a failure.
#
# The goal: technical debt can only DECREASE over time. New code stays small;
# legacy oversized files must be refactored down, not extended.
#
# Usage:
#   bash scripts/check-file-size.sh
#
# Exit code: 0 on success, 1 on any violation.

set -u

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

BUDGETS_FILE="scripts/file-size-budgets.txt"
DEFAULT_TS=500
DEFAULT_RS=800

lookup_budget() {
  # $1 = path; prints max on stdout (empty if not budgeted).
  [ -f "$BUDGETS_FILE" ] || return 0
  # Match: leading whitespace, digits, whitespace, exact path, end-of-line.
  awk -v target="$1" '
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }
    {
      max = $1
      path = $2
      if (path == target) { print max; exit }
    }
  ' "$BUDGETS_FILE"
}

FILES=$(find src src-tauri/src \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.rs' \) \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*/target/*' \
  -not -name '*.d.ts' \
  2>/dev/null | sort)

fail=0
checked=0
violations=""

for f in $FILES; do
  case "$f" in
    *.test.ts|*.test.tsx) continue ;;
  esac

  lines=$(wc -l < "$f" | awk '{print $1}')
  checked=$((checked + 1))

  budget=$(lookup_budget "$f")
  if [ -n "$budget" ]; then
    max="$budget"
    kind="budgeted"
  else
    case "$f" in
      *.rs)       max=$DEFAULT_RS ;;
      *.ts|*.tsx) max=$DEFAULT_TS ;;
      *)          continue ;;
    esac
    kind="default"
  fi

  if [ "$lines" -gt "$max" ]; then
    if [ "$kind" = "budgeted" ]; then
      violations="${violations}❌ $f: $lines lines (budgeted max: $max) — grew past its frozen baseline. Refactor smaller, do not raise the budget.
"
    else
      violations="${violations}❌ $f: $lines lines (default max: $max) — split this file, or if truly unavoidable, add it to $BUDGETS_FILE with justification.
"
    fi
    fail=1
  fi
done

if [ -n "$violations" ]; then
  printf '%s' "$violations"
fi

echo ""
echo "Checked $checked source files."
if [ $fail -ne 0 ]; then
  echo "File size check FAILED."
  exit 1
fi
echo "File size check passed."
