#!/usr/bin/env bash
# Install additional BYOK model providers into the existing LibreChat API.
# No existing config is overwritten. Database/search containers are untouched.
set -euo pipefail

container="${MINE_LIBRECHAT_CONTAINER:-mine-oss-librechat-api-1}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd "$script_dir/.." && pwd)"
catalog="$repo_dir/config/mine-models.librechat.yaml"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose is required." >&2
  exit 1
fi
if ! docker inspect "$container" >/dev/null 2>&1 || [[ ! -f "$catalog" ]]; then
  echo "ERROR: Missing running LibreChat API or MINE catalog. Nothing changed." >&2
  exit 1
fi
existing_config="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/librechat.yaml"}}{{.Source}}{{end}}{{end}}' "$container")"
if [[ -n "$existing_config" ]]; then
  echo "Existing LibreChat YAML is mounted at: $existing_config"
  echo "To preserve your settings, MINE will not overwrite it."
  echo "Merge endpoints.custom from config/mine-models.librechat.yaml into that YAML manually."
  exit 2
fi

project="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$container")"
service="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.service" }}' "$container")"
config_files="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$container")"
project_dir="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$container")"

if [[ "$service" != api || ! "$project" =~ ^[A-Za-z0-9_-]+$ || ! -d "$project_dir" || -z "$config_files" ]]; then
  echo "ERROR: Unrecognized Compose project. Nothing changed." >&2
  exit 1
fi

declare -a compose
compose=(docker compose -p "$project")
IFS=',' read -r -a source_files <<< "$config_files"
for item in "${source_files[@]}"; do
  if [[ "$item" = /* ]]; then source_file="$item"; else source_file="$project_dir/$item"; fi
  if [[ ! -f "$source_file" ]]; then
    echo "ERROR: Missing Compose source $source_file. Nothing changed." >&2
    exit 1
  fi
  compose+=(-f "$source_file")
done

managed_dir="$HOME/.config/mine-ai"
mkdir -p "$managed_dir"
local_catalog="$managed_dir/${project}.models.librechat.yaml"
local_overlay="$managed_dir/${project}.models.compose.yaml"
if [[ -e "$local_overlay" ]] && ! grep -q '^# Managed by MINE AI models setup' "$local_overlay"; then
  echo "ERROR: Refusing to modify unmanaged Compose overlay. Nothing changed." >&2
  exit 1
fi
if [[ -e "$local_catalog" ]] && ! grep -q '^# MINE AI local model catalog' "$local_catalog"; then
  echo "ERROR: Refusing to replace unmanaged LibreChat YAML. Nothing changed." >&2
  exit 1
fi

cp "$catalog" "$local_catalog"
cat > "$local_overlay" <<YAML
# Managed by MINE AI models setup
services:
  api:
    volumes:
      - type: bind
        source: "$local_catalog"
        target: /app/librechat.yaml
        read_only: true
YAML

compose+=(-f "$local_overlay")
cd "$project_dir"
"${compose[@]}" config --quiet
echo "Recreating the LibreChat API only, using the MINE BYOK model catalog."
"${compose[@]}" up -d --no-deps --force-recreate "$service"
echo "The API is up. MINE catalog mounted:"
docker inspect -f '{{range .Mounts}}{{if eq .Destination "/app/librechat.yaml"}}{{.Destination}}{{end}}{{end}}' "$container"
echo "Refresh http://localhost:3090 and configure your OpenRouter/API keys via the provider settings gear."
