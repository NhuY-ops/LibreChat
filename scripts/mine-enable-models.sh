#!/usr/bin/env bash
# Enable the built-in LibreChat BYOK providers on the existing local Compose API.
# Recreates ONLY the API service; keeps all existing MongoDB/search volumes.
set -euo pipefail

container="${MINE_LIBRECHAT_CONTAINER:-mine-oss-librechat-api-1}"
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose is required." >&2
  exit 1
fi
if ! docker container inspect "$container" >/dev/null 2>&1; then
  echo "ERROR: Container '$container' not found; nothing changed." >&2
  exit 1
fi

project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$container")"
service="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.service" }}' "$container")"
config_files="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$container")"
project_dir="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$container")"

for item in "$project" "$service" "$config_files" "$project_dir"; do
  if [[ -z "$item" || "$item" == '<no value>' ]]; then
    echo "ERROR: Incomplete Compose metadata; nothing changed." >&2
    exit 1
  fi
done
if [[ "$service" != api || ! "$project" =~ ^[A-Za-z0-9_-]+$ || ! -d "$project_dir" ]]; then
  echo "ERROR: This is not a recognized local LibreChat API service; nothing changed." >&2
  exit 1
fi

IFS=',' read -r -a source_files <<< "$config_files"
compose=(docker compose -p "$project")
for item in "${source_files[@]}"; do
  if [[ "$item" = /* ]]; then source_file="$item"; else source_file="$project_dir/$item"; fi
  if [[ ! -f "$source_file" ]]; then
    echo "ERROR: Missing original Compose file: $source_file" >&2
    exit 1
  fi
  compose+=(-f "$source_file")
done

managed_dir="$HOME/.config/mine-ai"
mkdir -p "$managed_dir"
overlay="$managed_dir/${project}.byok.compose.yaml"
if [[ -e "$overlay" ]] && ! grep -q '^# Managed by MINE AI BYOK setup' "$overlay"; then
  echo "ERROR: Refusing to overwrite an unmanaged file: $overlay" >&2
  exit 1
fi

# These are BYOK markers, NEVER real secrets. LibreChat handles per-user keys.
cat > "$overlay" <<'YAML'
# Managed by MINE AI BYOK setup
# Contains BYOK markers only; do not put real credentials here.
services:
  api:
    environment:
      OPENAI_API_KEY: user_provided
      ANTHROPIC_API_KEY: user_provided
      GOOGLE_KEY: user_provided
YAML

compose+=(-f "$overlay")
cd "$project_dir"
if ! "${compose[@]}" config --quiet; then
  echo "ERROR: Compose validation failed; containers unchanged." >&2
  exit 1
fi
printf 'Using original Compose project %s with MINE BYOK overlay.\n' "$project"
echo "Recreating ONLY the existing API service; other services stay untouched."
"${compose[@]}" up -d --no-deps --force-recreate "$service"

echo "Checking container environment (no secrets will be printed):"
docker exec "$container" node -e '
for (const key of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_KEY"]) {
  const value = process.env[key];
  const status = value === "user_provided" ? "USER_PROVIDED" : value ? "CONFIGURED" : "MISSING";
  console.log(key + ": " + status);
}
'
echo "Open http://localhost:3090 and reload MINE AI, then select a model."
