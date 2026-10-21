# MINE Knowledge Base — first integrated slice

## Implemented in this commit

- Dedicated authenticated `/knowledge` route in the existing shell and KB rail entry.
- Live **read-only user-owned indexed file inventory** based on the existing `useGetFiles` endpoint and RAG's `embedded === true` marker.
- Search, empty/loading/error and retry states. Opens existing **My Files** dialog and the existing Agent Builder.
- No new storage, permissions, embedding pipeline, cross-Agent sharing, API credentials or breaking changes to Research Analyst/RAG.

This is **not** the planned independent KB resource system. It is an honest first integration surface over existing user files. An `embedded` flag is evidence the file was indexed, not proof it is authorized for every Agent. File Search enforcement remains server-side.

## Next implementation (not yet built)

1. Persist separate KB libraries/collections with owner/team/project scope, explicit memberships, tag identity and access controls.
2. Add user-scoped document-to-library association and server-side membership filtering **before** any retrieval; support tag ANY/ALL.
3. Add authorized upload/embedding pipeline for new KB sources with per-item status, retry and deletion cleanup, reusing existing RAG.
4. Connect KB to Chat and Agent runtime through opt-in selection and file citations; do not automatically expose user files globally.
5. Implement explicit OAuth data connectors (Drive, Notion, GitHub) and opt-in website ingestion, safe sync scheduling, revoke and deletion.
6. Add operational tests for tenant isolation, RAG retrieval authorization, connector revocation, and prompt-injection-resistant document rendering.

## Local verification

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development
cd client
npm run typecheck
NODE_ENV=development npx jest --runInBand --coverage=false --watch=false src/components/KnowledgeBase/knowledgeFiles.spec.ts
```

Open `http://localhost:3090/knowledge` with the usual frontend/backend running.
