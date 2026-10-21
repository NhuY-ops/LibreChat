# MINE Image Studio V1 — Existing Agent image tools, no duplicate media backend

## Grounding
LibreChat already implements server-side Agent image tools in
`api/app/clients/tools/structured/OpenAIImageTools.js`,
`GeminiImageGen.js`, `FluxAPI.js`, `StableDiffusion.js`.
Server manifests expose the pluginKeys:

| Tool Library label | pluginKey | Credential/server requirement |
| --- | --- | --- |
| OpenAI Image Tools | `image_gen_oai` | `IMAGE_GEN_OAI_API_KEY`; optional `IMAGE_GEN_OAI_MODEL` |
| Gemini Image Tools | `gemini_image_gen` | Gemini/Google API key or Vertex service account |
| Flux | `flux` | `FLUX_API_KEY` |
| Stable Diffusion | `stable-diffusion` | `SD_WEBUI_URL` to a running Automatic1111-compatible WebUI |

The repo's existing Agent tool runtime already handles authenticated requests,
tool progress, returned image artifacts, file storage strategy, and display in
Chat. Image Studio **does not bypass these services** or make direct image API
calls from the browser.

## What's included
In **Agent Marketplace → Templates → AI Image Creator → Use template**:
1. Apply the template in the new-Agent builder.
2. **Image Studio V1** appears under the Agent template setup.
3. Choose one of the four image providers. Tool availability and "Needs setup"
   come from the same permission/auth-filtered Agent Tool Library catalog.
4. If available, click **Add** to stage the pluginKey into this **draft**;
   otherwise open **Tools → Add** and configure the provider. No key is read,
   saved, or exposed by this widget.
5. Enter the creative description and choose an aspect (square, landscape,
   portrait) and preferred quality (draft/standard/high).
6. Click **Copy image request**.
7. Save the Agent, click **Use in Chat**, paste the request and send it. The
   server-side image tool generates and saves an image **only if** it is really
   available, configured and authorized.
8. View the image in Chat, and use the Chat's existing file/media controls.

All copy and tool-add actions require explicit user interactions, and
selecting a template alone never enables a tool or charges a provider.

## Fix: AI Image Creator selection disappears on navigation

The Chat router may normalize `/c/new?mineAgentTemplate=image-creator` to
`/c/new` before the Agent Builder component renders. The earlier pilot read
only the URL search parameter, so it could show a blank **Create New Agent**
panel and an unrelated **Research Analyst V1** conversation still selected on
the right. This did not indicate that the Image Creator was installed in the
Research Agent or that its model/tools had changed.

The Gallery now writes a temporary same-tab Jotai handoff atom **before**
opening Agent Builder. The new-Agent editor reads that id even if the route
strips the URL query. The id is consumed only after an explicit **Apply
Marketplace template** (or **Replace draft**) action, which fills the unsaved
form. After application, the studio helper can rediscover the template from
its exact default instructions/name following a ModelPanel remount.

**How to use:** Open Agent Marketplace → Templates → Images → AI Image Creator
→ Use template. Close any open **Create New Agent** dropdown, find the
**Start with an Agent template** box beneath the builder header, and click
**Apply Marketplace template**. The new form should show **AI Image Creator**
and below it **Image Studio V1 — Generate through your Agent**. It is *not*
a separately saved Agent until you choose and save a model. The chat area
on the right may still show the previously used Research Analyst; that
is independent of the new-Agent builder draft.

## Limits and guarantees
- **Integration-ready, not end-to-end verified on the user's Mac:** We cannot
  assert an image rendered until the tool is selected, provider access works,
  and a real Chat generation succeeds. A text model such as Groq `gpt-oss-20b`
  **does not share OpenAI image-model credits**; generation credentials are
  separate. An API key with exhausted funds will not produce media.
- The model selects and calls the tool from Chat; choosing **Copy image request**
  never executes a generation on its own.
- Providers do not necessarily accept the same pixel dimensions, options,
  or aspect ratios. The generated request treats quality/ratio as preferences,
  and tells the model to use the nearest supported option.
- Reusing native image tools preserves the backend's permissions and file
  handling. No new image database or asset library is created by this milestone.
- For the known Mac Docker setup, changes to `~/mine-ai` client source appear
  on `http://localhost:3090` in Vite, **not** automatically on the separately
  containerized port 3210.
- Do not paste API keys into Chat or GitHub. Set credentials only through the
  provider's authorized Tool Library configuration or private deployment env.
  **Do not** use `docker compose down -v` while adjusting media configuration.

## Local verification

```bash
cd ~/mine-ai
git pull --ff-only origin mine-development
cd client
npm run typecheck
npx jest --runInBand \
  src/components/SidePanel/Agents/MineImageStudioPilot.test.tsx \
  src/components/SidePanel/Agents/MineAgentQuickStart.test.tsx \
  src/components/Agents/tests/MineTemplateMarketplace.spec.tsx
cd ..
BACKEND_PORT=3210 npm run frontend:dev
```

Manual smoke check:
- Open `http://localhost:3090/agents/templates`, choose Images → AI Image
  Creator → Use template → Apply Marketplace template.
- Confirm Image Studio V1 renders. Check that unknown/missing providers are
  "Unavailable" and unauthenticated providers show "Needs setup" without a
  misleading "Ready" claim.
- Choose a server-listed configured provider, click Add, and ensure its tool
  appears in the draft. Save. Your existing Research Analyst must be unchanged.
- Copy a short creative request and send in Chat. Only call this a full PASS
  when the tool trace displays a successful image result, not a text-only
  description or a provider error.
- If the model replies that no key or funds are available, configure a
  compatible image provider separately. OpenAI's API image credits are not
  supplied by Groq.

## Next: dedicated image-first workspace
With one successful server-tool image render verified, extend the UI to include
a dedicated `/studio/image` workflow with direct image previews, persistent
generation history and an image-editing selection tool. Avoid parallel image
storage or unaudited API calls that would bypass LibreChat's user-aware file
retention and provider billing pathways.
