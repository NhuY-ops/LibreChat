# MINE Knowledge Base V4.3 — first-message selection

Status: **phase B source drafted; tests and Mac acceptance pending. NOT deployed.**
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


## Phase B source implementation update (2026-10-28)

The source branch now includes POST `/api/knowledge/chat/prepare`.
It verifies the authenticated owner and tenant; accepts only a regular
(non-Agent/non-Assistant) endpoint, a selected model, a random UUID retry key,
and up to 50 authorized owner-owned KB IDs with normalized tag filters.
It derives a stable owner-scoped conversation ID from the retry key,
inserts an owned non-temporary conversation with `$setOnInsert`, then inserts
the regular-chat KB selection using `$setOnInsert`. A conflicting retry does
not modify the existing model or selected KBs. It returns a conversation ID
only after the saved selection matches. A failed selection write leaves at
most an unusable blank chat with no KB grant; it cannot authorize RAG.

The New Chat KB picker can now list owner KBs and "Prepare chat with KBs";
it calls this endpoint, navigates to the saved chat and lets the user type
their first actual question with KB already selected. The MVP blocks
preparation if the unsent text field is nonempty, rather than silently
discarding the text when navigating; **select KBs before typing**.
This is not an automatic send feature.

New route tests cover valid preparation, owner authorization, retries,
rejected foreign KBs, conflict handling, and failed writes. These tests
are written but **have not been run on the developer Mac**.

Remaining acceptance gates:
- Run Jest and client typecheck on Mac; fix failures before deploy.
- Confirm API can create a valid empty conversation the existing app loads.
- Confirm New Chat -> select KB -> prepare -> first prompt -> file citation.
- Confirm KB0 never sends unscoped RAG requests and Agent V4.2 still works.
- Improve draft migration and optional UX polish after functional validation.

Do not deploy this branch before the Mac tests and independent review.


## Empty saved conversation spinner fix (2026-10-28)

After a successful New Chat "Prepare chat with KBs", the router navigated to an
already-saved conversation with **zero** messages. Old ChatView logic
`isNavigating = !messagesTree && conversationId != null` treated *every* empty
saved chat as if it were still fetching, and showed a permanent spinner.

The V4.3 frontend now recognizes an empty saved conversation only when its
message query has finished, the active conversation ID matches the current
route, and there is no outstanding routePending state. It renders the normal
landing composer while preserving the already-saved ID. A missing/mismatched
conversation, unresolved message query, or history still loading remains in
the old guarded spinner path. The first real message still sends to the
prepared conversation; no dummy greeting is needed.

Files added/changed:
- `client/src/components/Chat/isSavedEmptyConversation.ts`
- `client/src/components/Chat/isSavedEmptyConversation.test.ts`
- `client/src/components/Chat/ChatView.tsx`

This change is frontend-only and requires local Mac Jest (client) and
typecheck before being called tested. Do not rerun backend V4.3 deploy simply
for this frontend change; the running API remains unchanged.


## Prepared Chat File Search toggle handoff (2026-10-29)

Safari end-to-end validation confirmed the saved-empty conversation spinner was
resolved and selected KB 1 persisted into the first message. However the
**File Search tool chip disappeared** after Prepare, so Groq had no File
Search tool to call; its "cannot access Knowledge Base" response was not
evidence of missing KB records or missing vectors.

The reason is that ephemeral tool state lives in
`ephemeralAgentByConvoId(conversationId)`. Transitioning from the New Chat
sentinel ID to a real prepared conversation ID doesn't automatically copy
those settings. V4.3 now invokes the existing tested
`useApplyNewAgentTemplate()` before `navigateToConvo()`, transferring
the current New Chat File Search/Web Search/code/etc toggles into the
prepared conversation's Recoil state. The BadgeRowProvider will persist the
result under the prepared chat ID when the composer mounts.

The patch copies the ACTUAL user's toggles and never auto-enables File
Search just because KB 1 is selected. Tests verify both ON and OFF
handoffs. No backend, DB, embedding, or Agent ACL change is necessary.

Developer Mac tests and first-message File Search with citation are still
required before treating the fix as verified. Previously prepared chats may
need File Search explicitly re-enabled using the + tools palette once;
the handoff occurs during NEW Prepare actions.
 

## Prepared-chat tools survive browser refresh (2026-10-29)

Even when the V4.3 Prepare action copied ephemeral File Search state via
`useApplyNewAgentTemplate`, that state lived in Recoil only. On a reload
`BadgeRowProvider` restores tool toggles using timestamped localStorage
keys suffixed with the **saved conversation ID**, not the New Chat key.
This mismatch could hide File Search after navigation or browser refresh,
while the owner-approved KB selection itself remained in MongoDB.

The New Chat Prepare path now reads the user's actual source ephemeral
tool state immediately after the server confirms the saved conversation,
copies it into the prepared conversation's in-memory state, AND writes
explicit toggles (including OFF) to the prepared ID's timestamped
localStorage keys before navigation. It retains the UI-selected MCP
server names only, not credentials. Selecting a KB cannot implicitly
turn File Search on. Existing saved chats are unaffected.

New frontend files:
- `client/src/components/Chat/Input/persistPreparedChatTools.ts`
- `client/src/components/Chat/Input/persistPreparedChatTools.test.ts`

Requires Mac validation:
`cd ~/mine-ai/client && npx jest --runInBand --coverage=false --watch=false src/components/Chat/Input/persistPreparedChatTools.test.ts && npm run typecheck`.

Acceptance requires a **brand-new prepared conversation** with File
Search ON and KB 1, first prompt correctly cited, browser reload retaining
both choices, and New Chat KB0 staying isolated. Older prepared chats
may require the File Search toggle to be manually switched on once.
