#!/usr/bin/env bash
# MINE KB V4.2 saved-regular-chat: source-only hotpatch of the existing API container.
# No Docker Compose up/down, no volume operations, no database migrations.
set -Eeuo pipefail

CONTAINER="${MINE_API_CONTAINER:-mine-oss-librechat-api-1}"
BACKUP_ROOT="${MINE_KB_BACKUP_ROOT:-$HOME/mine-kb-v4-backups}"
API_URL="${MINE_KB_API_URL:-http://127.0.0.1:3210/api/knowledge}"
FILES=(
  api/server/routes/knowledge.js
  api/server/services/KnowledgeBase/agentAccess.js
  api/server/services/KnowledgeBase/chatSelection.js
  api/server/services/KnowledgeBase/chatAccess.js
  api/app/clients/tools/util/fileSearch.js
  api/app/clients/tools/util/handleTools.js
)
NEW_FILE="api/server/services/KnowledgeBase/chatSelection.js"
NEW_CHAT_ACCESS_FILE="api/server/services/KnowledgeBase/chatAccess.js"
backup_dir=""
modified=0

usage() {
  cat <<'HELP'
Usage:
  bash scripts/mine-kb-v42-deploy.sh check
  bash scripts/mine-kb-v42-deploy.sh deploy
  bash scripts/mine-kb-v42-deploy.sh rollback /absolute/path/to/backup

Run from repository root (~/mine-ai). Deploy only after API Jest tests pass.
The script backs up all existing API files before copying any V4 code and
rolls those files back automatically on failed copy/syntax/health checks.
If the newly introduced KB resolver files did not exist before deploy, rollback leaves
unused extra file in place (no MongoDB data or embeddings are deleted).
HELP
}

require_repo() {
  if [[ ! -d .git || ! -f api/server/routes/knowledge.js ]]; then
    echo "ERROR: Run from the MINE repository root (cd ~/mine-ai)." >&2
    exit 2
  fi
}

check_local_files() {
  local f
  for f in "${FILES[@]}"; do
    [[ -f "$f" ]] || { echo "ERROR: Missing source file: $f" >&2; return 1; }
    node --check "$f" || return 1
  done
  echo "Six backend source files passed Node syntax checks."
}

check_container() {
  command -v docker >/dev/null || { echo "ERROR: Docker CLI unavailable" >&2; return 1; }
  [[ "$(docker inspect --format '{{.State.Running}}' "$CONTAINER" 2>/dev/null)" == true ]] || {
    echo "ERROR: API container $CONTAINER is not running" >&2
    return 1
  }
  local f
  for f in "${FILES[@]}"; do
    if [[ "$f" != "$NEW_FILE" && "$f" != "$NEW_CHAT_ACCESS_FILE" ]]; then
      docker exec "$CONTAINER" test -f "/app/$f" || {
        echo "ERROR: Existing container file missing: /app/$f" >&2
        return 1
      }
    fi
  done
  echo "API container $CONTAINER is running; existing destinations verified."
}

check_health() {
  local status=""
  local attempt
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    status="$(curl --max-time 5 -s -o /dev/null -w '%{http_code}' "$API_URL" || true)"
    if [[ "$status" == 401 ]]; then
      echo "KB API unauthenticated HTTP 401: healthy auth gate."
      return 0
    fi
    sleep 2
  done
  echo "ERROR: KB API expected HTTP 401, got '$status'." >&2
  return 1
}

restore_files() {
  local dir="$1" f
  [[ -d "$dir" && -f "$dir/.mine-kb-v4-backup" ]] || {
    echo "ERROR: This is not a MINE KB V4 backup: $dir" >&2
    return 1
  }
  for f in "${FILES[@]}"; do
    if [[ -f "$dir/$f" ]]; then
      docker cp "$dir/$f" "$CONTAINER:/app/$f" || return 1
    fi
  done
  docker restart "$CONTAINER" >/dev/null || return 1
  check_health
}

on_error() {
  local status=$?
  trap - ERR
  if [[ "$modified" == 1 && -n "$backup_dir" ]]; then
    echo "Deploy failed; restoring original API files from $backup_dir" >&2
    restore_files "$backup_dir" || echo "URGENT: Automatic rollback failed. Restore the saved files manually." >&2
  fi
  exit "$status"
}
trap on_error ERR

main() {
  local action="${1:-}" f
  case "$action" in
    check)
      require_repo
      check_local_files
      check_container
      echo "Read-only checks complete. No files copied and no containers restarted."
      ;;
    deploy)
      require_repo
      check_local_files
      check_container
      command -v curl >/dev/null || { echo "ERROR: curl unavailable" >&2; return 1; }
      mkdir -p "$BACKUP_ROOT"
      backup_dir="$(mktemp -d "$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)-XXXXXX")"
      # Back up EVERYTHING before changing ANY container file.
      for f in "${FILES[@]}"; do
        if docker exec "$CONTAINER" test -f "/app/$f"; then
          mkdir -p "$backup_dir/$(dirname "$f")"
          docker cp "$CONTAINER:/app/$f" "$backup_dir/$f"
        elif [[ "$f" != "$NEW_FILE" && "$f" != "$NEW_CHAT_ACCESS_FILE" ]]; then
          echo "ERROR: Existing file disappeared during backup: $f" >&2
          return 1
        fi
      done
      printf 'container=%s\nhead=%s\n' "$CONTAINER" "$(git rev-parse HEAD)" > "$backup_dir/.mine-kb-v4-backup"
      echo "Backed up original API files to: $backup_dir"
      modified=1
      for f in "${FILES[@]}"; do
        docker cp "$f" "$CONTAINER:/app/$f"
        docker exec "$CONTAINER" node --check "/app/$f"
      done
      docker restart "$CONTAINER" >/dev/null
      check_health
      modified=0
      echo "V4.2 backend hotpatch deployed. No Docker volumes or MongoDB/RAG data modified."
      echo "Rollback command: bash scripts/mine-kb-v42-deploy.sh rollback '$backup_dir'"
      ;;
    rollback)
      local target="${2:-}"
      [[ "$target" == /* ]] || { echo "ERROR: Provide an absolute backup directory." >&2; return 2; }
      check_container
      restore_files "$target"
      echo "API files restored from $target. DB and RAG data unchanged."
      ;;
    *) usage; [[ -z "$action" || "$action" == help || "$action" == --help ]] || return 2 ;;
  esac
}
main "$@"