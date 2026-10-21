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

## Using it with a new Agent
In the Agent editor, select **Research** from the starter templates. This
fills the Research V1 instructions and 3 starters, preserving whichever model,
provider, and tools are already chosen. Tool connections require explicit setup.
Create the Agent using the ordinary flow, then attach knowledge files inside
**Tools → File Search** (not File Context alone).

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
