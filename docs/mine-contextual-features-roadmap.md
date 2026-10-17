# MINE — Chat-first Contextual Features (product decision)

**Positioning:** One Platform. Every AI. One Outcome.

MINE must not become merely a model picker or a sidebar of disconnected
products. Its key interaction is **intent → appropriate capability → user
approval as needed → tangible outcome**.

## Design rules

1. Chat is the default landing experience. No mode switch is required to
   express an ordinary request.
2. A contextual suggestion is not a side effect. It may explain and link to a
   real tool but must not claim that unsupported execution occurred.
3. Every capability remains discoverable without magic: searchable **Explore
   all features**, the `+` menu, and slash commands offer an explicit path.
4. Only present installed and authorized skills as runnable. Show unavailable
   skills as unavailable, with setup requirements.
5. Suggestions are quiet: avoid repeating a suggestion the user dismissed
   and never obscure the composer.
6. Read and preview first. Sending email, changing external files, publishing
   content, deploying code, booking, or running costly actions require
   appropriately scoped authorization and confirmation.
7. Minimize exposure of private documents and keys. Keep team/project context
   isolated by permissions and clear source boundaries.
8. Preserve LibreChat's Chat, Projects, Agents and existing model key flow;
   add features in modular layers with tests.

## Build phases

**Phase A — Recent & Projects polish (in progress)**
- Recent date grouping with optional Running/Finished activity view
- Chat hover timestamp, existing rename/pin/archive/move-to-project
- Fast Create Project action

**Phase B — Capability Registry & Discovery**
- Registry entries: id, label, category, what-it-does, required connections,
  permissions, status (ready/setup/coming-soon), action route.
- Browse/search UI and `+` composer discovery; never create inert controls.
- First set: Projects, Files, Agents, Model Compare, Research (if connected),
  Code, Tasks, Docs/Sheets/Slides (clearly marked future until implemented).

**Phase C — Intent Suggestions**
- Suggestions from chat context; no automatic third-party execution.
- Suggestions communicate why, what data access is needed, estimated usage
  costs when known, and a dismissal path.
- Start with deterministic capability/intent triggers and measure acceptance;
  later use AI-assisted routing only when its safety can be evaluated.

**Phase D — Outcome objects**
- A typed outcome associates chat messages, references, file/project outputs,
  approval state, and a durable next action.
- Cross-workspace activity follows user permissions.
- Agents, Docs/Sheets/Slides and more advanced tools become outcome producers.

## Non-goals in this phase

- No promise of 3–8 models being sent in parallel (MINE currently executes 2).
- No autonomous access to email/files or unsolicited proactive action.
- No reimplementation of existing LibreChat functionality solely for branding.
