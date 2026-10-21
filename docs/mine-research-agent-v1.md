# MINE Research Analyst V1 — evidence-first upgrade

## Scope
Research Analyst V1 improves the **existing Agent instructions and starters** rather than
creating a new provider, tool, autonomous workflow, or proprietary literature database.

The other Agent templates remain unchanged. Research V1 covers:
- **Planning:** research question, population/setting, design, outcome and exposure
  definitions, confounding, bias, sample-size assumptions, ethics, and analysis.
- **Literature review:** search strategy, relevance screening, authoritative source
  preference, article-versus-snippet distinction, and publication type.
- **Verification:** no invented DOI, PMID, links, publication dates, quotations, or
  use of tools; explicitly disclose what could not be verified.
- **Evidence synthesis:** study designs/populations, limitations, conflicting findings,
  evidence tables when useful, uncertainty and generalizability.
- **Academic writing:** protocols and drafts with source-backed claims, not fictional
  patient results, approval dates, analyses, or accepted manuscripts.

### Important boundaries
- Research V1 is **instruction guidance**, not a guaranteed source-validation engine.
  A real DOI/PMID/link is only verified if a configured tool actually retrieves it.
- Ask User, File Search, and Web Search use **existing permissioned capabilities**.
  This change does not auto-enable tools, create API credentials, or bypass a tool's
  auth/rate limits.
- A clinic sample cannot establish population-wide prevalence by default;
  cross-sectional associations do not establish causality, and a sample-size target
  needs an explicit statistical rationale.
- All model outputs still require human source verification for consequential
  medical or academic work.

## Using it with a new Agent from Agent Marketplace
1. In the left navigation rail, select **Agent Marketplace** directly below **Agent Builder**.
   It opens the **Templates** page (`/agents/templates`). The former standalone
   Marketplace shortcut above the rail divider was moved to this location.
2. Preview Research Analyst or another curated blueprint, then choose **Use template**.
   The app navigates to `/c/new?mineAgentTemplate=research`.
3. Open the **Agents builder** panel if it is not already visible, then click
   **Apply Marketplace template** in the new-Agent quick-start guide.
4. Choose the model, inspect the populated inline instructions and starters,
   opt in to Tools, and use the normal **Create** action. Template selection
   does not create an Agent, connect a provider, or consume model credits.
5. Attach knowledge files inside **Tools → File Search**, not File Context alone.

The Marketplace template gallery contains *blueprints*, not published/shared
Agent instances. The existing Marketplace published-Agent grid and its permissions
remain separate; **Explore Agents** returns to the published-Agent list.

## Upgrading an existing Research Analyst (opt-in)
1. Open **Agents → Research Analyst** in the builder.
2. Find **Research Analyst V1** directly below Instructions.
3. Click **Review V1 upgrade**, read the replacement warning, and either
   choose **Keep current** or **Replace instructions**.
4. If replacing, inspect the instructions and click the ordinary **Save**
   button to persist them. No save is sent by the upgrade button itself.
5. The action deliberately **does not** modify model/provider, tools, API keys,
   File Search knowledge files, description, conversation starters or permissions.
6. If the Agent uses **Prompt-linked instructions**, switch to **Inline** yourself
   before replacing; the upgrade cannot silently break the linked Prompt.

Existing instructions are replaced only after confirmation. If the previous
customization matters, copy it elsewhere before confirming.

## Running the updated UI while Docker serves an older frontend
The local source checkout at `~/mine-ai` is not the same deployment as the
Docker Compose app served on port **3210** from
`~/Developer/MINE-OSS-Playground/config/librechat` (the user's known setup).
A successful `git pull` or `npm run typecheck` only updates/validates source.

For a non-destructive development preview, keep the API container on port 3210,
open a separate Terminal, and run:

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development
BACKEND_PORT=3210 npm run frontend:dev
```

Then use **http://localhost:3090** for the source-code UI. Vite's dev proxy
uses `BACKEND_PORT` to forward `/api` and `/oauth` to the existing Docker
backend. Do not browse the older port 3210 for unbuilt frontend changes.
If Vite selects another port because 3090 is busy, use the port printed by Vite.
This route does not rebuild or restart RAG, Postgres, or the API containers.

Before claiming the full Docker UI on 3210 is updated, inspect its image/bind
mounts and plan a deployment of the compiled app to that runtime; do not
blindly replace the container with a registry image or call `down -v`.

## Local verification
After pulling `mine-development`, run:

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development
cd client
npm run typecheck
cd ..
npx jest client/src/components/SidePanel/Agents/mineAgentTemplates.test.ts \
  client/src/components/SidePanel/Agents/MineResearchV1Upgrade.test.tsx \
  client/src/components/SidePanel/Agents/MineAgentQuickStart.test.tsx \
  client/src/components/Agents/tests/MineTemplateMarketplace.spec.tsx \
  --runInBand
```

These are unit/static checks. They cannot prove that a running instance, provider,
File Search index, or web service is functioning. Redeployment depends on whether
the browser is connected to the local development frontend or another container
image; pulling GitHub files alone does not update a separately built Docker UI.

## Observed manual pilot outcomes (October 2026)
User-reported testing on their Mac:
- Existing Research Analyst invoked **Ask User** and displayed an interactive
  question. The subsequent research outline was generated successfully.
- **File Search / RAG + Ollama** retrieved `MINE-PILOT-042` and the unique phrase
  from a known test file. A separate new Chat with no chat attachment also
  retrieved the content from an Agent-linked knowledge file.
- **Web Search** returned actual links and metadata in its tool trace; a long
  response encountered a provider rate/spend-limit error, followed by a short
  request returning a plausible PubMed citation.
These observations establish a functional pilot, **not** blanket research
accuracy, complete reliability under rate limits, or a formal clinical validation.

## Suggested V1 smoke check
Test with a fictional protocol about melanoma prevalence in dermatology
outpatients ages 25–35. Expect explicit warning that clinic prevalence is not
general population prevalence, and that 500–800 participants cannot be called
adequately powered without prevalence/precision/events-per-predictor assumptions.
Then ask for 2 directly relevant PubMed prevention studies: verify titles,
publication years and URLs against the source pages and reject adjacent
melanoma treatment studies as prevention evidence. Finally summarize a saved
knowledge file and make sure the trace shows File Search actually ran.

Do not label a model response “verified” without checking its cited source.
