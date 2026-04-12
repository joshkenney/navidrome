#!/usr/bin/env bash
# check-social-schema.sh — Verify and apply social-listening DB fields.
#
# Usage:
#   ./check-social-schema.sh [/path/to/navidrome.db]
#
# If no argument is given the script looks for navidrome.db in the current
# directory, then in the default Docker data volume path (/data).
#
# Requirements: sqlite3 CLI must be on PATH.

set -euo pipefail

# ── colour helpers ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; }
info() { echo -e "        $*"; }

# ── locate the database ────────────────────────────────────────────────────
if [[ $# -ge 1 ]]; then
    DB="$1"
else
    # Auto-detect: current dir first, then Docker default
    for candidate in "./navidrome.db" "/data/navidrome.db"; do
        if [[ -f "$candidate" ]]; then
            DB="$candidate"
            break
        fi
    done
fi

if [[ -z "${DB:-}" ]]; then
    err "Could not find navidrome.db. Pass the path explicitly:"
    info "$0 /path/to/data/navidrome.db"
    exit 1
fi

if [[ ! -f "$DB" ]]; then
    err "File not found: $DB"
    exit 1
fi

if ! command -v sqlite3 &>/dev/null; then
    err "sqlite3 is not installed or not on PATH."
    info "Install it with:  apt-get install sqlite3   (Debian/Ubuntu)"
    info "                  apk add sqlite             (Alpine / Docker image)"
    exit 1
fi

echo ""
echo "Navidrome social-listening schema check"
echo "DB: $DB"
echo "──────────────────────────────────────────────"

PASS=0
FIXED=0
ISSUES=0

# ── helper: run a SQL statement ────────────────────────────────────────────
sql() { sqlite3 "$DB" "$@"; }

# ── 1. scrobbles table ─────────────────────────────────────────────────────
echo ""
echo "1. scrobbles table (records listening history)"
TABLE_EXISTS=$(sql "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='scrobbles';")

if [[ "$TABLE_EXISTS" -eq 1 ]]; then
    ok "Table 'scrobbles' exists."
    ROW_COUNT=$(sql "SELECT COUNT(*) FROM scrobbles;")
    info "Row count: $ROW_COUNT"
    PASS=$((PASS+1))
else
    warn "Table 'scrobbles' is missing."
    info "This table is created by Navidrome's built-in migrations."
    info "Make sure 'EnableScrobbleHistory = true' is set in your config,"
    info "then start Navidrome once to let the migrations run."
    ISSUES=$((ISSUES+1))
fi

# ── 2. user.share_activity column ─────────────────────────────────────────
echo ""
echo "2. user.share_activity column (opt-out flag for activity sharing)"
COL_EXISTS=$(sql "SELECT COUNT(*) FROM pragma_table_info('user') WHERE name='share_activity';")

if [[ "$COL_EXISTS" -eq 1 ]]; then
    ok "Column 'user.share_activity' exists."

    # Show distribution so the operator can see current state
    ALL=$(sql "SELECT COUNT(*) FROM user;")
    SHARING=$(sql "SELECT COUNT(*) FROM user WHERE share_activity = 1;")
    HIDDEN=$(sql "SELECT COUNT(*) FROM user WHERE share_activity = 0;")
    info "Users total: $ALL  |  sharing: $SHARING  |  private: $HIDDEN"
    PASS=$((PASS+1))
else
    warn "Column 'user.share_activity' is missing — applying fix..."
    if sql "ALTER TABLE user ADD COLUMN share_activity boolean NOT NULL DEFAULT 1;" 2>&1; then
        ok "Added 'share_activity' column (all existing users default to sharing=ON)."
        FIXED=$((FIXED+1))
    else
        err "Failed to add column. Is another process holding the DB?"
        ISSUES=$((ISSUES+1))
    fi
fi

# ── 3. goose_db_version sanity check ──────────────────────────────────────
echo ""
echo "3. Migration version check"
LATEST_VER=$(sql "SELECT MAX(version_id) FROM goose_db_version WHERE is_applied=1;" 2>/dev/null || echo "unknown")
if [[ "$LATEST_VER" == "unknown" ]]; then
    warn "Could not read goose_db_version table."
    ISSUES=$((ISSUES+1))
else
    ok "Latest applied migration: $LATEST_VER"
    EXPECTED="20260412000000"
    if [[ "$LATEST_VER" -ge "$EXPECTED" ]]; then
        info "Social-listening migration ($EXPECTED) is recorded as applied."
    else
        warn "Migration $EXPECTED has not been applied via goose."
        info "The column fix above (if run) patches the schema directly."
        info "Start Navidrome once normally to let goose record the migration."
    fi
fi

# ── summary ────────────────────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────"
echo "Summary: ${PASS} OK  |  ${FIXED} fixed  |  ${ISSUES} need attention"

if [[ $ISSUES -gt 0 ]]; then
    echo ""
    warn "Some checks need attention — see output above."
    exit 2
fi

if [[ $FIXED -gt 0 ]]; then
    echo ""
    ok "All issues were fixed automatically. Restart Navidrome to pick up changes."
fi

if [[ $ISSUES -eq 0 && $FIXED -eq 0 ]]; then
    echo ""
    ok "All checks passed. No changes needed."
fi
