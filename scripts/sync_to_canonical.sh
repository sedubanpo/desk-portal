#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_CODE="$REPO_ROOT/apps-script/payroll/Code.gs"
SOURCE_HTML="$REPO_ROOT/apps-script/payroll/Index.html"

CANONICAL_CODE="/Users/anjongseong/Documents/프로그램/에스에듀 개발/payroll/code.gs"
CANONICAL_HTML="/Users/anjongseong/Documents/프로그램/에스에듀 개발/payroll/payroll_portal.html"

cp "$SOURCE_CODE" "$CANONICAL_CODE"
cp "$SOURCE_HTML" "$CANONICAL_HTML"

echo "Synced repo payroll files back to canonical:"
echo "  $CANONICAL_CODE"
echo "  $CANONICAL_HTML"
