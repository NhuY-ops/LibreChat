# MINE Knowledge Base V4.3 — first-message selection

Status: **design + owner-scoped catalog only**, NOT an end-to-end implementation.
Branch: `mine-kb-v43-first-turn-20261028` (stacked on V4.2).

## Verified starting point (2026-10-28)

- V4.2: 93/93 backend Jest tests PASS and safe API hotpatch deployed locally.
- Existing saved Agent chat retrieves a granted KB with citation.
- Existing saved regular Groq chat can retrieve a user-selected KB through an ephemeral runtime Agent.
- A chat with KB 0 responded that no files were available. The screenshot shows a
  File Search step but not its raw tool tuple. Do **not** treat the screenshot
  alone as conclusive proof of query isolation.
- Fresh New Chat displays `KB —` because ChatKnowledgePicker currently requires
  an already-saved conversationId.

## Phase A (this branch — implemented)

`GET /api/knowledge/chat/new/available` lists only KB metadata belonging
to the authenticated request owner and tenant. It returns
`{ available, selected: [], inherited: false, pending: true }`.
It does **not** authorize search, create an empty conversation, or write a selection.
The same scope checks as existing KB management apply.
API tests cover user/tenant isolation, no implicit selection, and no DB writes.

## Phase B (required before UI enablement or deployment)

Provide an authenticated, idempotent **prepare-chat** operation on the server,
with the following invariants:

1. Validate current owner and tenant server-side (do not accept either from
   a client field); reject system tenant, unsupported endpoints, temporary chats,
   malformed/duplicate KB IDs and invalid tags.
2. Filter requested KB IDs against current owner-owned KB records; for an
   Agent-chat variant also require verified ownership of that Agent AND
   existing explicit Agent grants. No implicit library inheritance in regular chats.
3. Reserve a random conversation ID and create the owned, non-temporary
   conversation record (matching the existing schema and normal endpoint
   semantics) **before** any model tool load; persist the chat KB selection
   under the same owner/tenant/conversation ID. Guard retries with a unique,
   owner-scoped idempotency key; never overwrite an existing conversation.
4. Do not return a ready-to-send conversation ID until the selection write
   succeeds and is owner-readable. If the operation fails, no search can be
   authorized, and the user retains their unsent message and staged selection.
   Provide safe compensation for blank provisional conversations.
5. The frontend's New Chat KB popup can display the Phase A catalog, but
   on Save it must atomically prepare the saved chat via Phase B, then navigate
   to that chat while preserving model, tools and draft text. The user can send
   the first meaningful message immediately — no "Hi" workaround.
6. On the first submitted turn, File Search resolves persisted selection through
   the V4.2 `resolveChatKnowledgeFiles` owner/tenant path. Empty selection
   must fail closed before reaching the external RAG service.
7. Subsequent changes use the existing `GET/PUT /api/knowledge/chat/:id`.
   Refresh must preserve selection, and unrelated chats must remain independent.
8. Do not modify MongoDB collections in bulk, delete vectors, reset Agents,
   or merge V4.2/V4.3 without verified tests. Regression-test Agent grants
   and direct user attachments independently.

## Required validation

- New regular chat: select KB 1 before first message; first reply retrieves
  owner-approved file in the correct original vector namespace, with citation.
- New regular chat: explicit KB 0; File Search gets no authorized files
  and never sends an unscoped empty RAG query.
- Fresh chat selection on one account does not appear in another account.
- Invalid/missing/expired KB or deleted Agent source → no retrieval.
- Switching model (e.g., Groq ephemeral Agent) preserves correct chat scope.
- Parallel Save or retries produce one prepared conversation and selection.
- Refresh/new tab/re-navigation preserve the selection and never leak draft
  text to an unrelated conversation.
- The V4.2 four-suite Jest regression tests still pass and frontend typecheck
  succeeds. Test the actual Mac Docker deployment only after these gates.

## Deployment

**DO NOT deploy this branch's phase A alone as V4.3**. The catalog endpoint
is preparatory and is not connected to New Chat yet. Continue implementation
of Phase B and frontend integration, run complete tests, then prepare a new
backed-up and reversible deployment script.
