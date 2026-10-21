# MINE Creative Studios V1 — curated Agent blueprints

## What shipped
A first expansion of the **Agent Marketplace → Templates** catalog from five to **29**
blueprints: the five established Agent starters plus 24 creative blueprints.

| Collection | Count | Included blueprints |
| --- | ---: | --- |
| Image & Photography | 6 | Image Creator; Photo Editor; Product Photography; Fashion Lookbook; Character Designer; Image Restoration |
| Video & Animation | 5 | Video Creator; Image Animator; Reels Producer; Storyboard Director; Product Demo |
| Design & Branding | 5 | Brand Identity; Poster Designer; Presentation Designer; UI/UX Prototyper; Infographic Designer |
| Audio & Music | 4 | Voiceover Studio; Podcast Producer; Music Composer; Audio Localization |
| Creator & Content | 4 | Campaign Factory; Comic Studio; Course Creator; Content Repurposer |
| Existing Essentials | 5 | Personal Copilot; Research Analyst V1; Marketing Strategist; Software Engineering Partner; Study Companion |

Templates are categorized and searchable; the gallery shows separate counts for All,
Essentials, Creative Studios, Images, Video, Design, Audio and Content. Every
creative card includes an optional production-workflow preview and any required
**external media tool**. The preview does not grant tools or run models.

**IMPORTANT: This is a working template catalog and instruction handoff, not a
working image/video/audio generator.** A model such as Groq's `gpt-oss-20b`
can write creative briefs, shot lists and prompts, but it does not generate
image, video or sound files by merely receiving a creative system prompt.

## User flow
1. Open the left-navigation **Agent Marketplace** icon (below Agent Builder).
2. Choose **Templates → Creative Studios** or a focused filter such as
   **Images** or **Video**. Browse and use existing global Search agents.
3. Click **Preview** for workflow, sample requests and prerequisite details.
4. Click **Use template**. The app switches the active left panel to
   **Agent Builder**, navigating to a new unsaved Agent draft.
5. Click **Apply Marketplace template**. Existing unsaved draft instructions
   are replaced only after explicit confirmation. The model/provider and
   existing tool state remain untouched.
6. Select and configure the desired model and Tools. The builder explains
   which additional media tool is needed to render a file.
7. Click the existing Agent **Create/Save** control. Nothing in the catalog
   silently creates, publishes, or runs an Agent.

## Capability levels
- **Planning-ready:** a normal text model can help create the plan, storyboard,
  script, prompt or handoff spec now, without a media renderer.
- **Tool needed:** the user still gets useful creative planning output, but
  **actual rendering** needs a configured compatible provider. Tools must be
  permissioned, authenticated, priced and tested separately. This milestone
  deliberately does not hard-code providers or keys or pretend to output files.
- **Production-ready media:** **not yet shipped**. It will require image/video/
  audio provider adapters, job progress/error handling, asset storage,
  permissions, safety and usage reporting, and integration tests. Preview
  and pricing must distinguish a successful render from a prompt-only answer.

All creative blueprints instruct the Agent not to invent generated files,
exports or URLs, to respect workspace file permissions, and to require consent
for another person's likeness or voice when appropriate.

## Non-goals and compatibility
This milestone does not change the user's saved **Research Analyst V1**, Groq,
its Ask User/File Search/Web Search tools, File Search knowledge files, existing
RAG/Ollama config, marketplace publishing permissions, or service credentials.
It reuses the *same* Agent builder and existing draft/save APIs.

## Verification on the Mac (Vite frontend at 3090)
```bash
cd ~/mine-ai
git pull --ff-only origin mine-development
cd client
npm run typecheck
npx jest --runInBand \
  src/components/SidePanel/Agents/mineAgentTemplates.test.ts \
  src/components/Agents/tests/MineTemplateMarketplace.spec.tsx \
  src/components/SidePanel/Agents/MineAgentQuickStart.test.tsx
cd ..
BACKEND_PORT=3210 npm run frontend:dev
```

Keep Vite running and visit **http://localhost:3090/agents/templates**.
Port **3210** serves the existing Docker backend and may continue serving a
different built client. The PostCSS `from` warning sometimes seen from Vite is
not, by itself, a TypeScript compiler failure.

## Smoke test
- The header shows **29 blueprints**. The Images filter displays **6**;
  Video displays **5**, Design **5**, Audio **4**, Content **4**.
- Select **Images → AI Image Creator → Preview**. The preview lists workflow
  stages and states that image generation requires a connected media tool.
- Click **Use template**. The left sidebar opens **Agent Builder** with
  an **Apply Marketplace template** button and a setup disclosure.
- Apply, inspect the instructions and save a **new** Agent with an authorized
  model. Without image generation tools, ask for a prompt/brief: the Agent
  must not claim an image was rendered.
- Confirm existing Research Analyst V1 still retains its model and tools.

## Next technical milestone — real Image Creator pilot
Pick **one** image provider and implement a provider-independent media tool
contract: input prompt/reference images, authorization, generation job,
status/error, generated file URI, user ownership/ACL, cost estimate,
download history and cancellation. Validate one end-to-end render before
copying this capability into the other Creative Studio templates.
Video and audio integrations follow only after image rendering is verified.
