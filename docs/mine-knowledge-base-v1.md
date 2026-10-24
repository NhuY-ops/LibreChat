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
