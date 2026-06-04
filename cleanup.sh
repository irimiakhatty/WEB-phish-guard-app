#!/usr/bin/env bash
# =============================================================================
# PhishGuard — Pre-distribution Cleanup Script
# Targets: node_modules, .next build cache, tsbuildinfo, dist artifacts, logs
# Excludes: ml-service/models (trained ML models — DO NOT DELETE)
# Usage:  ./cleanup.sh          → dry-run (safe preview)
#         ./cleanup.sh --run    → executes deletion
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY_RUN=true
TOTAL_FREED=0

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

if [[ "${1:-}" == "--run" ]]; then
  DRY_RUN=false
fi

print_header() {
  echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗"
  echo -e "║       PhishGuard Pre-Distribution Cleanup            ║"
  echo -e "╚══════════════════════════════════════════════════════╝${RESET}"
  if $DRY_RUN; then
    echo -e "${YELLOW}  MODE: DRY-RUN — nothing will be deleted${RESET}"
    echo -e "${YELLOW}  Run with --run to execute actual cleanup${RESET}"
  else
    echo -e "${RED}  MODE: LIVE — files WILL be permanently deleted${RESET}"
  fi
  echo ""
}

bytes_to_human() {
  local bytes=$1
  if   (( bytes >= 1073741824 )); then awk -v b="$bytes" 'BEGIN { printf "%.1f GB", b/1073741824 }'
  elif (( bytes >= 1048576 ));    then awk -v b="$bytes" 'BEGIN { printf "%.1f MB", b/1048576 }'
  elif (( bytes >= 1024 ));       then awk -v b="$bytes" 'BEGIN { printf "%.1f KB", b/1024 }'
  else printf "%d B" "$bytes"; fi
}

remove_target() {
  local path="$1"
  local label="$2"

  if [[ ! -e "$path" ]]; then
    return
  fi

  local size
  size=$(du -sb "$path" 2>/dev/null | awk '{print $1}' || echo 0)
  TOTAL_FREED=$(( TOTAL_FREED + size ))
  local human
  human=$(bytes_to_human "$size")

  if $DRY_RUN; then
    echo -e "  ${YELLOW}[DRY]${RESET} ${label}"
    echo -e "        ${CYAN}${path}${RESET}  (${human})"
  else
    echo -e "  ${RED}[DEL]${RESET} ${label}  (${human})"
    rm -rf "$path"
  fi
}

# =============================================================================
print_header

# ── 1. node_modules ───────────────────────────────────────────────────────────
echo -e "${BOLD}[1/5] node_modules directories${RESET}"

# Find all node_modules, excluding ml-service Python venvs (none here)
while IFS= read -r -d '' nm; do
  # Skip nested node_modules inside node_modules
  [[ "$nm" =~ /node_modules/.+/node_modules ]] && continue
  remove_target "$nm" "node_modules"
done < <(find "$SCRIPT_DIR" -type d -name "node_modules" -print0 2>/dev/null)

# ── 2. Next.js build & dev artefacts ─────────────────────────────────────────
echo -e "\n${BOLD}[2/5] Next.js build + dev artefacts (.next/)${RESET}"
remove_target "$SCRIPT_DIR/apps/web/.next"  ".next (full build + cache + dev server state)"

# ── 3. TypeScript build info ──────────────────────────────────────────────────
echo -e "\n${BOLD}[3/5] TypeScript incremental build caches (*.tsbuildinfo)${RESET}"
while IFS= read -r -d '' f; do
  remove_target "$f" "tsbuildinfo → $(basename "$(dirname "$f")")"
done < <(find "$SCRIPT_DIR" -name "*.tsbuildinfo" -not -path "*/node_modules/*" -print0 2>/dev/null)

# ── 4. dist/ output folders ───────────────────────────────────────────────────
echo -e "\n${BOLD}[4/5] Compiled dist/ folders${RESET}"
while IFS= read -r -d '' d; do
  # Never touch ml-service/models
  [[ "$d" =~ ml-service ]] && continue
  [[ "$d" =~ node_modules ]] && continue
  remove_target "$d" "dist → $(realpath --relative-to="$SCRIPT_DIR" "$d")"
done < <(find "$SCRIPT_DIR/packages" -type d -name "dist" -print0 2>/dev/null)

# ── 5. Log files ──────────────────────────────────────────────────────────────
echo -e "\n${BOLD}[5/5] Log files${RESET}"
while IFS= read -r -d '' f; do
  [[ "$f" =~ node_modules ]] && continue
  remove_target "$f" "log → $(basename "$f")"
done < <(find "$SCRIPT_DIR" -name "*.log" -not -path "*/node_modules/*" -print0 2>/dev/null)

# ── Bun lock / package-lock (optional) ───────────────────────────────────────
# Not removed — needed for reproducible installs.

# =============================================================================
echo -e "\n${BOLD}${GREEN}═══════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Estimated space to be freed: $(bytes_to_human $TOTAL_FREED)${RESET}"

if $DRY_RUN; then
  echo -e "${YELLOW}  This was a dry-run. To apply: ./cleanup.sh --run${RESET}"
else
  echo -e "${GREEN}  Cleanup complete.${RESET}"
  echo -e "${CYAN}  Reinstall dependencies: bun install (from repo root)${RESET}"
fi
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════════${RESET}\n"

# ── Safety note on the .rar archive ──────────────────────────────────────────
RAR="$SCRIPT_DIR/../phish-guard-app.rar"
if [[ -f "$RAR" ]]; then
  rar_size=$(du -sb "$RAR" 2>/dev/null | awk '{print $1}' || echo 0)
  echo -e "${YELLOW}  NOTE: phish-guard-app.rar found alongside the project"
  echo -e "  Size: $(bytes_to_human $rar_size)"
  echo -e "  This archive is a duplicate of the source tree."
  echo -e "  Delete it manually once you have a remote backup:${RESET}"
  echo -e "  ${CYAN}  rm \"$RAR\"${RESET}\n"
fi
