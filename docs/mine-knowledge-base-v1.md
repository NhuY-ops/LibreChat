# MINE Knowledge Base V2 — persistent private collections

## Delivered (commit on mine-development)

- Dedicated `/knowledge` route in the MINE app shell.
- Existing RAG file inventory: indexed status, search and My Files shortcut.
- **Create KB** with name/description; saved persistently in MongoDB `mineknowledgebases`.
- List/select private KB collections, attach and detach **existing embedded files**, inspect attached file metadata, and delete a KB without deleting source files or RAG data.
- Backend `/api/knowledge` routes require JWT and scope all KB reads/writes by authenticated owner plus current tenant (or the explicit legacy non-tenant scope).
- The backend checks ownership, tenant, embedded state and expiration for every file attachment. It rechecks those conditions before returning file metadata.
- Collections are metadata only: they do **not** grant any new agent/chat retrieval permissions. Existing Research Analyst, Skills, File Search and the RAG data pipeline are unchanged.
- Same-name uploaded files remain distinct by `file_id` (do not deduplicate by filename).
- **KB-scoped document tags:** add/remove up to 10 tags (32 characters each) for a document association within a selected KB; Unicode NFKC/trim/lowercase normalization. Tags persist in MongoDB and are returned only after original document access is revalidated.
- Removing a document link also removes that KB association's tags; the underlying file and embeddings remain untouched.
- Tags are organizational metadata only: they do **not** currently filter retrieval or grant Agent/Chat access. The same file can have different tags inside different KBs.

## Backend API (authenticated)

- `GET /api/knowledge` — list current user's collections
- `POST /api/knowledge` — create collection, body: `{ name, description? }`
- `PATCH /api/knowledge/:id` — rename collection (API exists; edit UI not wired yet)
- `DELETE /api/knowledge/:id` — delete collection only (not the original files)
- `GET /api/knowledge/:id/files` — list current-user-accessible linked metadata
- `POST /api/knowledge/:id/files` — attach previously indexed user-owned file, body `{ file_id }`
- `DELETE /api/knowledge/:id/files/:fileId` — unlink file only
- `PATCH /api/knowledge/:id/files/:fileId/tags` — replace per-KB tags after owner/tenant/linked-file checks, body: `{ tags: string[] }`

Limits: 100 KBs per user for the first iteration; 250 file references per KB.
The 100-KB check is currently a preflight count, not a transactional hard quota; enforce atomically before offering multi-tenant paid plans.

## Verify on Mac

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development

cd client
npm run typecheck
NODE_ENV=development npx jest --runInBand --coverage=false --watch=false src/components/KnowledgeBase/knowledgeFiles.spec.ts

# From repository root: server-side route tests
cd ..
cd api
NODE_ENV=test npx jest --runInBand --coverage=false --watch=false server/routes/knowledge.test.js
cd ..
```

**Critical deployment caveat:** the base `docker-compose.yml` uses `registry.librechat.ai/librechat-ai/librechat-dev:latest` for the `api` service and does not bind-mount the application's source directory. Running `git pull` or restarting that stock container alone **will not** load this locally modified route.

Before testing Create KB, confirm the backend serving the frontend is running **this checked-out source**. For a stock Docker API container:

```bash
cd ~/mine-ai
docker compose exec api sh -c 'test -f /app/api/server/routes/knowledge.js && echo KB_ROUTE_PRESENT || echo KB_ROUTE_MISSING'
```

`KB_ROUTE_MISSING` means that API process still uses a prebuilt image. Use a source-backed development API process or an appropriate local Docker development override. Never replace persistent volumes or run `docker compose down -v` merely for this feature. Check the existing `PORT`, proxy and Mongo/RAG networking before launching a second backend so ports do not collide.

Once the updated API is serving, open `http://localhost:3090/knowledge`, create a private KB, select it and click **Add** next to an indexed file. The header count should increase, and reloading the page should retain the KB association.

## Next phase, NOT included here

- Direct file upload and embedding initiated on the KB page
- Tag-based retrieval authorization, auto-sync, external connectors (Drive, Notion, GitHub, web)
- Agent/Chat KB access with server-enforced retrieval authorization and citations
- Shared Teams/Project KB and ACL roles

Do **not** retrofit KB membership into the current File Search authorization until dedicated cross-tenant retrieval and access tests are complete.

## MINE KB V2.1 tags on the existing development container

The user's running backend is `mine-oss-librechat-api-1` from the separate
`mine-oss-librechat` Compose project in `~/Developer/MINE-OSS-Playground/config/librechat`,
not the default Compose project in `~/mine-ai`.

Its API entry point was already patched for `/api/knowledge` and tested with HTTP 401
for an unauthenticated call. To update **only** the KB files with tags after pulling:

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development

cd api
NODE_ENV=test npx jest --runInBand --coverage=false --watch=false server/routes/knowledge.test.js
cd ../client
npm run typecheck
NODE_ENV=development npx jest --runInBand --coverage=false --watch=false src/components/KnowledgeBase/knowledgeFiles.spec.ts
cd ..

docker cp api/server/routes/knowledge.js mine-oss-librechat-api-1:/app/api/server/routes/knowledge.js
docker cp api/server/services/KnowledgeBase/model.js mine-oss-librechat-api-1:/app/api/server/services/KnowledgeBase/model.js
docker restart mine-oss-librechat-api-1
```

This is a development-only hotpatch: `docker restart` retains the in-container
entry-point patch, but `docker compose up --force-recreate` using the stock image
would discard it. Avoid deleting volumes or restoring older KB files over newer ones.
A durable custom API image/source-backed development mount is recommended before
further feature iterations.

## MINE Knowledge Base V3: opt-in Agent File Search

The Agent Builder now includes **Knowledge Base Access** for saved Agents. It lists
the owner's private KBs, each disabled by default. Enable individual KBs;
leave tags blank for all linked documents, or use a comma-separated list
such as `immunology, research` for **ANY** tag matching.

The grant is saved directly to `MineKnowledgeBase.agent_access`. It is **not**
an Agent field and does not modify the existing Agent form/attachments.
Only the owner of both the KB and Agent can create or revoke a grant.
Shared Agents never automatically inherit another user's KB.

When the Agent has the built-in **File Search** tool enabled:
- `primeFiles` resolves selected KBs against owner/tenant/Agent, validates
  that each file remains linked, owned, embedded and unexpired.
- The tool rechecks KB grants immediately before each search query, so revocation,
  unlinking a file, or editing tags takes effect for subsequent tool calls.
- Existing directly uploaded Agent files remain unchanged, including when KB
  grants are revoked. File Search still has its original permission checks.
- RAG citations still follow the existing File Search implementation.
- Without File Search selected, granting KB access does **not** cause the model
  to search autonomously. This version does not add KB access to ordinary chats.

**Scope:** Existing private owner KBs only; no Team access, no shared-agent
KB propagation, no connector sync. API `PUT /api/knowledge/:id/agent-access/:agentId`
accepts `{ enabled: boolean, tags: string[] }`; omission or `enabled:false` means
no access. The GET KB collection list includes `agent_access` only to its owner.

### Test from the checked-out MINE repository

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development

cd api
NODE_ENV=test npx jest --runInBand --coverage=false --watch=false server/routes/knowledge.test.js
NODE_ENV=test npx jest --runInBand --coverage=false --watch=false server/services/KnowledgeBase/agentAccess.spec.js
NODE_ENV=test npx jest --runInBand --coverage=false --watch=false test/app/clients/tools/util/fileSearch.test.js

cd ../client
npm run typecheck
```

### Update the existing development-only Docker hotpatch

**Only after tests pass.** This user's actual backend runs as
`mine-oss-librechat-api-1` on host port 3210 under a separate Compose
project. Its `/app/api/server/index.js` already registers `/api/knowledge`;
do not override that entry point or recreate the stock image.

```bash
cd ~/mine-ai
C=mine-oss-librechat-api-1
BACKUP="$HOME/mine-kb-v3-backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

for FILE in \
  api/server/routes/knowledge.js \
  api/server/services/KnowledgeBase/model.js \
  api/app/clients/tools/util/fileSearch.js \
  api/app/clients/tools/util/handleTools.js
do
  mkdir -p "$BACKUP/$(dirname "$FILE")"
  docker cp "$C:/app/$FILE" "$BACKUP/$FILE"
done

docker cp api/server/routes/knowledge.js "$C:/app/api/server/routes/knowledge.js"
docker cp api/server/services/KnowledgeBase/model.js "$C:/app/api/server/services/KnowledgeBase/model.js"
docker cp api/server/services/KnowledgeBase/agentAccess.js "$C:/app/api/server/services/KnowledgeBase/agentAccess.js"
docker cp api/app/clients/tools/util/fileSearch.js "$C:/app/api/app/clients/tools/util/fileSearch.js"
docker cp api/app/clients/tools/util/handleTools.js "$C:/app/api/app/clients/tools/util/handleTools.js"
docker restart "$C"

curl -sS -o /dev/null -w 'KB API HTTP: %{http_code}\n' http://localhost:3210/api/knowledge
```

Expected unauthenticated result is HTTP **401**. A 500 or a restarting API
should be investigated before using the Agent; the four saved originals in
`$BACKUP` support rollback, followed by `docker restart "$C"`.
Do not remove MongoDB/RAG volumes or reset agent data. For production, replace
this hotpatch with a source-built API image and immutable versioned deployment.

Test in the UI: open the saved Agent's Builder, enable **File Search**,
enable `medical research` under **Knowledge Base Access** and optionally
set the `immunology` tag. Save the grant and ask the Agent a question
that can only be answered by a permitted KB file. Then disable that KB
and ask again in a *new* conversation; the Agent must no longer retrieve
that KB, though knowledge disclosed in earlier chat messages can remain
in conversational context.

## MINE KB V3.1 — fix cross-namespace empty RAG results

A file attached **via a new private KB** may have been embedded in the user's
RAG namespace before it was associated with an Agent. Previously the KB
integration set `fromAgent: true`, which caused the RAG query to include
`entity_id: agent_ID`. That selects the Agent namespace rather than the
original user-indexed file. An HTTP 200 with zero hits is a possible symptom.

The File Search priming fix sets `fromAgent` only for original direct Agent
tool-resource file IDs, not for a `kbManaged` association. The RAG source
also defensively refuses Agent-namespace scoping for a KB-managed file.
Owner, tenant, attachment and Agent-grant checks remain unchanged.

The user's running container is a development-only hotpatch.
`fileSearch.js` is loaded from `/app/api/app/clients/tools/util/fileSearch.js`,
so after pulling the V3.1 commit and passing its tests, replace only that
file in the existing container and restart **just the API**:

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development
cd api
NODE_ENV=test npx jest --runInBand --coverage=false --watch=false test/app/clients/tools/util/fileSearch.test.js
cd ..
C=mine-oss-librechat-api-1
B="$HOME/mine-kb-file-search-backup-$(date +%Y%m%d-%H%M%S).js"
docker cp "$C:/app/api/app/clients/tools/util/fileSearch.js" "$B"
docker cp api/app/clients/tools/util/fileSearch.js "$C:/app/api/app/clients/tools/util/fileSearch.js"
docker restart "$C"
for i in {1..20}; do
  status=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3210/api/knowledge || true)
  echo "KB API: $status"
  if [ "$status" = 401 ]; then break; fi
  sleep 2
done
```

A JWT-free request should receive HTTP 401 after startup. If not, restore the
backed-up `fileSearch.js` and restart the same container. Do not recreate
Compose services or reset RAG/Mongo volumes.

**Validation:** In a new Research Analyst chat, search a distinctive
phrase/content from the existing linked document. First prove the expected
File Search source is returned and cited, then revoke the KB grant and verify
a subsequent new conversation cannot retrieve it. No-content responses may
also reflect documents whose embeddings exist only in an old Agent namespace
or documents containing no relevant passage. This patch cannot silently
reindex Agent-private sources into a user scope; a dedicated opt-in ingestion
pipeline is needed for those cases.
