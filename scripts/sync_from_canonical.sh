#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

CANONICAL_CODE="/Users/anjongseong/Documents/프로그램/에스에듀 개발/payroll/code.gs"
CANONICAL_HTML="/Users/anjongseong/Documents/프로그램/에스에듀 개발/payroll/payroll_portal.html"

TARGET_CODE="$REPO_ROOT/apps-script/payroll/Code.gs"
TARGET_HTML="$REPO_ROOT/apps-script/payroll/Index.html"

cp "$CANONICAL_CODE" "$TARGET_CODE"
cp "$CANONICAL_HTML" "$TARGET_HTML"

echo "Synced canonical payroll files into repo:"
echo "  $TARGET_CODE"
echo "  $TARGET_HTML"
