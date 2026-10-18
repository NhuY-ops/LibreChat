# MINE Research Analyst — one-template tool pilot

**Goal:** Validate that a real Agent template can recommend, persist and
actually invoke built-in Tools before building a 30-template library or adding
new external integrations.

## Scope

Only **Research Analyst** has this experimental recommended-tools panel.
The other 4 templates and the existing Agent save/mutation flows are unchanged.

Selecting Research fills name, description, inline instructions and three
conversation starters. It **does not** enable any tool. The pilot lists three
*existing* native Tool Library entries, gated by the user's real catalog:

| Tool | How it is stored in LibreChat | When it can run |
| --- | --- | --- |
| Ask User | \`tools: ['ask_user_question']\` | Only if admin enabled the capability/plugin and the selected model supports invoking it |
| Web Search | \`web_search: true\`, persisted as built-in \`web_search\` tool | Only if user has permission and the required search credentials are configured |
| File Search | \`file_search: true\`, persisted as built-in \`file_search\` tool | Only if allowed and the saved Agent has indexed **knowledge files** available |

An absent catalog item shows **Unavailable**, not an enable button.
An auth-gated Web Search item shows **Needs setup**, not a bypass.
All Add controls require the user's click and never make network calls by
themselves. Existing nonpilot Tools, credentials and model remain untouched.

### Important file distinction

**File Context** in the Agent editor uses \`EToolResources.context\`. The
**File Search** built-in uses \`EToolResources.file_search\`, its own knowledge
files. Uploading a file in File Context alone is not a sufficient test of File
Search retrieval. The Agent must exist before uploads can be attached.

## Local developer checks

\`\`\`bash
cd ~/mine-ai
git pull --ff-only origin mine-development
cd client
npm run typecheck
\`\`\`

To run tests with existing repo test infrastructure:

\`\`\`bash
cd ~/mine-ai
npx jest client/src/components/SidePanel/Agents/mineAgentTemplates.test.ts \
  client/src/components/SidePanel/Agents/MineAgentQuickStart.test.tsx \
  client/src/components/SidePanel/Agents/MineResearchPilotTools.test.tsx \
  --runInBand
\`\`\`

The committed tests check:
- Choosing a template never auto-enables Tools;
- Only a deliberate **Add** mutates \`ask_user_question\`,
  \`web_search\` or \`file_search\` fields;
- A required credential prevents enabling Web Search from the pilot;
- Tools hidden by permissions cannot be added via the pilot;
- Existing model/provider values survive template application.

These tests **do not** test a real provider, search API or file retrieval.

## Manual end-to-end smoke test

1. Open MINE → **Agents** → **Create New Agent**.
2. Select **Research**; inspect the filled-in instructions and starter prompts.
3. In **Research Pilot — Test these tools**, click **Add** for Ask User.
   Click **Add** for Web Search and File Search only if shown as available.
   Otherwise open **Tools → Add** to review the reason and configure the
   required credentials, without bypassing access controls.
4. Choose a provider/model **already verified to support tool calls**, and
   click **Create**. The model being listed (including \`gpt-6-astra\`) is not
   evidence that it can actually make requests.
5. For **File Search**, open its built-in tool details on the saved Agent and
   attach one small nonsensitive text/PDF document as a *knowledge file*.
   Wait for the file to finish processing/indexing if the UI reports progress.
   Do **not** treat a File Context-only upload as a valid File Search test.
6. Click **Use in Chat** and run these requests **one at a time**:

   - Ask User: **"I need help researching a topic, but I haven't chosen the
     question. If Ask User is available, use it to ask me one question to
     define the scope, then continue from my answer."**
     Pass if the interface pauses for the tool question and resumes after reply.
   - Web Search: **"Using Web Search, find a recent official announcement about
     a technology topic. Give the primary source URL and publication date.
     If search is not available, say so; don't invent citations."**
     Pass if a tool invocation/result is visible and sources open.
   - File Search: upload a test file containing a unique phrase such as
     \`silver lantern research sample 2026\`, then ask **"Use File Search to
     quote the unique phrase from the knowledge file and identify where
     it appears. Do not guess."** Pass if the model retrieves the real phrase
     from that attached file rather than hallucinating.

7. Observe the tool traces and any authorization/connection errors. A normal
   assistant reply is **not proof** the tool ran; check the actual tool result.

## Decision gate

Promote the pilot to additional templates only after:
- \`npm run typecheck\` and focused tests pass;
- Create → Save → Use in Chat succeeds;
- At least one real configured tool executes and its result is visible;
- Web Search missing-key and File Search missing-file states are clear;
- A failed tool invocation is surfaced to the user rather than silently
  represented as successful research.

If any step fails, fix this pilot first. Do not build the 30-template gallery
or add more providers until the core tool binding is trusted.
