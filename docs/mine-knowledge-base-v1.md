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

## MINE KB V3.2 — verified legacy Agent RAG provenance (2026-10-24)

Confirmed on the user's read-only MongoDB diagnostic: `medical research` links
to a file with `context: agents`, `embedded: true`, and an original vector
namespace belonging to the same user's **Research Analyst V1**. The current
recipient is a separate **Research Analyst V1 (10/21/26, 07:55)**.

V3.1 incorrectly assumed every KB file was user-indexed and omitted
`entity_id`; HTTP 200 with no vector hits was therefore possible.

V3.2 now loads `metadata.embeddedEntities` only for a KB-linked, owned,
unexpired, embedded File, validates the referenced source Agent's owner and
tenant against the KB owner, and uses the verified source Agent's namespace
for RAG requests. Source Agent IDs are never returned to the KB UI. Missing
or foreign sources are excluded (fail closed); ordinary user-indexed KB
files remain user-scoped. The recipient Agent's own resources retain their
existing namespace. Mixed scopes perform separate queries with combined
results/citation offsets. Grant and provenance are **re-evaluated before
every File Search tool call**, preserving immediate revocation semantics.

The Agent grant update also fixes MongoDB aggregation variable references:
`$$grant.agent_id` and `$$entry.file_id`. These corrections prevent
subsequent duplicate associations, but **do not remove existing duplicates**
until the owner explicitly saves/replaces a grant again.

### Test this version before touching Docker

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development
cd api
NODE_ENV=test npx jest --runInBand --coverage=false --watch=false \
  server/routes/knowledge.test.js \
  server/services/KnowledgeBase/agentAccess.spec.js \
  test/app/clients/tools/util/fileSearch.test.js
cd ..
```

Do not deploy if any test fails. Tests for original namespaces, mismatched
owners/tenants, revocation, mixed namespaces and atomic grants are included.

### Minimal development-container deployment after PASS

The real app container is `mine-oss-librechat-api-1` under a different Docker
Compose project than the repository's default. The API entry point for KB has
already been hotpatched inside that container. Keep it and its volumes
unchanged. After tests pass:

```bash
cd ~/mine-ai
C=mine-oss-librechat-api-1
B="$HOME/mine-kb-v32-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$B/api/server/routes" "$B/api/server/services/KnowledgeBase" "$B/api/app/clients/tools/util"
for f in \
  api/server/routes/knowledge.js \
  api/server/services/KnowledgeBase/agentAccess.js \
  api/app/clients/tools/util/fileSearch.js
do
  docker cp "$C:/app/$f" "$B/$f" || exit 1
done
for f in \
  api/server/routes/knowledge.js \
  api/server/services/KnowledgeBase/agentAccess.js \
  api/app/clients/tools/util/fileSearch.js
do
  docker cp "$f" "$C:/app/$f" || exit 1
done
docker restart "$C"
```

Use `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3210/api/knowledge`
after restart, retrying for startup. Unauthenticated HTTP 401 is expected.
Only a real File Search result with an original passage/citation establishes
successful end-to-end retrieval. The backend source change under
`packages/api/src/files/rag/search.ts` supports future rebuilds; this
development hotpatch uses the existing compiled package API and does not
require deploying TypeScript directly.

Rollback by copying the same 3 files from the timestamped backup and restarting
API. Never delete DB/RAG volumes or re-embed/delete the user's documents
without explicit permission.

## MINE Knowledge Base V4.1 — Chat KB Toggle (Agent chats)

**Scope in this patch:** existing, saved, non-temporary **Agent conversations**
with File Search enabled. Ordinary non-Agent chat and new-chat selection
before the first message require different routing and are **not yet in V4.1**.

A compact `KB N` control next to the chat composer's + icon opens a list of
all KBs already granted to the current Agent. The user can enable/disable
multiple KBs **for this conversation**, and optionally add further comma-
separated tag filters per KB. The Save button persists an explicit selection
and is isolated by authenticated owner, tenant, conversation ID and Agent ID.
Refreshing the page retains the selection. If there is no chat-specific record,
V3 Agent grants are inherited (backward-compatible). Saving an empty list
explicitly disables all KB files for that chat.

The backend requires that the conversation belongs to the authenticated user,
is not temporary, and references an Agent authored by that same user/tenant.
A chat selection can **only narrow** the Agent's existing KB grants and
granted tags, never expand them. A second Mongo collection
`minechatknowledgeselections` has a unique scoped key. File Search priming
and execution independently resolve the current selection, preserving V3.2's
source namespace and grant revocation guarantees. Directly attached Agent
File Search resources are independent of KB toggles and are not removed.

### Regression tests

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development
cd api
NODE_ENV=test npx jest --runInBand --coverage=false --watch=false \
  server/routes/knowledge.test.js \
  server/services/KnowledgeBase/agentAccess.spec.js \
  test/app/clients/tools/util/fileSearch.test.js
cd ..
```

Do not deploy on test failures. For frontend confidence, use
`cd client && npm run typecheck` (separate dependency/build requirements apply).

### Controlled local deployment after all backend tests pass

The user's running API container is `mine-oss-librechat-api-1` and needs **five**
files: the new `chatSelection.js` model, updated Knowledge Base route,
resolver, File Search utility, and `handleTools.js`. This source code is not
mounted. Copy the new file plus updated files to `/app` after backing up the
four existing files, then restart only this API container. Do NOT recreate
the Compose project or reset MongoDB/RAG volumes. Before hotpatching, remember
that TypeScript frontend code is served by the **separate local Vite dev
server** on :3090: Vite will pick up the new React source after git pull.

When the API is ready, unauthenticated
`curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3210/api/knowledge`
should return HTTP 401. Additional routes respond with 401 when unauthenticated.

### UI manual test

1. Open an existing Research Analyst Agent chat (or send one short message in
   a new chat to establish a persisted conversation).
2. Locate the `KB N` button next to + in the composer; open it.
3. Toggle `medical research` off, click Save for this chat, and start a new
   message **in that same conversation** without directly attaching the KB file.
   Search should no longer have access to the unique verification phrase.
4. Toggle it on, Save, and search again. The source citation should return.
5. Open a second saved Agent conversation: its selection should be independent.
   Refresh the first conversation: its selection must persist.
6. Test optional tag filtering using 2 differently tagged documents:
   selected tags narrow the results, while untagged files are excluded.
7. Revoke the underlying Agent grant in the Agent Builder and verify the
   chat picker no longer offers it and File Search cannot retrieve it even
   if the conversation selection previously included it.

V4.2 can add pre-first-message selection and separate non-Agent chat support
with authenticated per-chat File Search and no reliance on an Agent's grants.


## MINE KB V4.2 phase 1 — saved regular chat KB access (2026-10-24)

This change is deliberately limited to existing **saved, non-temporary, owner-only
regular conversations**. V4.1 saved Agent chats remain unchanged. It does
**not** yet let a New Chat search selected KBs in its first message.

- The composer now renders the Chat KB picker for regular chats with tools enabled,
  using the existing popup portal fix. Unlike Agents, regular chats start with
  **KB 0** and inherit no KBs.
- GET/PUT `/api/knowledge/chat/:conversationId` distinguishes an owned Agent
  conversation (V3 Agent grants) from an owned regular conversation (owned KBs
  only). Existing Agent records keep their previous unique-index key.
- Regular selections live in the same `minechatknowledgeselections` collection
  with an internal `__mine_regular_chat__` key. The client cannot forge the
  scope; it is determined by a server-side lookup of the owned conversation.
- File Search resolves only explicitly selected KBs in saved regular chats.
  It re-checks user, tenant, conversation, current membership/tags, embedded
  status, expiry, and original Agent RAG namespace every invocation.
  Turning KB off between priming and tool execution denies the KB file.
- Direct user attachments are not changed. Shared conversations and temporary
  chats cannot create or inherit regular KB selections.

**Development validation (not a claim of execution):**

```bash
cd ~/mine-ai/api
NODE_ENV=test npx jest --runInBand --coverage=false --watch=false \
  server/routes/knowledge.test.js \
  server/services/KnowledgeBase/agentAccess.spec.js \
  server/services/KnowledgeBase/chatAccess.spec.js \
  test/app/clients/tools/util/fileSearch.test.js
cd ~/mine-ai/client
npm run typecheck
```

Deploy after both pass using `scripts/mine-kb-v42-deploy.sh`, which backs up
and copies exactly six backend JS files; it restarts only the API container.
Do not reuse the old five-file V4.1 deploy script for this patch.

**Manual test:** In a saved regular chat with File Search enabled, select
`medical research`, save, ask a document question that does not reveal its
answer, check File Search citation; disable KB and use a fresh regular chat
with an explicit `KB 0` selection to verify the document cannot be searched.
Separately verify existing Agent V4.1 chats still work as before.

**Next stage:** pre-first-message KB selection with fail-closed first-turn
authorization and first-message persistence; ordinary chats that do not have
the File Search tool enabled cannot retrieve KB content.


### V4.2 phase 1 patch — stale Agent ID in a Groq/regular conversation

A real local MongoDB diagnostic (2026-10-28) found a saved `Short Greeting`
conversation with `endpoint: "groq"` but an old nonempty `agent_id`.
Before the patch, both the picker and `authorizedChat` interpreted any
nonempty `agent_id` as proof of an Agent chat. Thus the picker displayed
Agent-only text and the API could return "Owned Agent not found" even for the
owner's ordinary Groq chat.

V4.2 now determines Agent-vs-regular mode from the conversation's **persisted
endpoint**, not from the presence of stale Agent metadata. The UI uses its
current endpoint to select picker mode. A real Agent endpoint with missing or
unauthorized Agent still fails closed. Regular chats still require a saved,
owned, non-temporary conversation and an explicit owner-KB selection. All
V4.1 Agent grant narrowing, tenant isolation and RAG checks remain in place.

Regression tests cover Groq chats with leftover `agent_id` for both the
KB GET/PUT API and the regular chat retrieval authorization.

This patch changes only source code; no historical conversations are rewritten.
