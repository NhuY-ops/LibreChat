# MINE model catalog and Compare mode

MINE's model selection is built on the LibreChat frontend/backend, rather than
hardcoded dropdown-only items.

## Bring Your Own API Key providers

The tracked template at `config/mine-models.librechat.yaml` adds:

- **OpenRouter** (dynamic catalog, `fetch: true`), with models from many vendors
- **DeepSeek**
- **Groq**
- **Mistral**
- **xAI / Grok**

OpenAI, Anthropic and Google continue to use the BYOK environment configuration
from `scripts/mine-enable-models.sh`.

Run locally after pulling the `mine-development` branch:

```bash
bash scripts/mine-add-models.sh
```

The helper detects the existing API Compose project and writes a separate
read-only mounted YAML plus an additional Compose overlay. It recreates only
the API service. It deliberately stops if an existing LibreChat YAML is mounted,
because replacing that file could remove custom endpoints/settings: merge the
`endpoints.custom` entries by hand in that case.

**Never commit real API keys.** Each provider is configured with
`apiKey: user_provided`; users enter their own key using the provider's gear
control in the selector. OpenRouter model access, billing, and quotas follow the
user's OpenRouter account.

## Model selection tray (up to 8 choices)

1. Pick the primary model as usual.
2. Open **Select a model** → **Select multiple +** and pick more provider/model entries.
3. The selection tray appears immediately above the message textarea, with a
   removable chip for each additional model. The first chip is the main model.
4. Click **Add models** in that tray to reopen the selector.
5. Click **Done** to stop adding. The selector remembers choices during this session.

**Execution status is explicit:**

- **Main** and **Live** are the existing two response streams supported by LibreChat.
- **Saved** means a model is selected in the UI but **not included in the current send**.
- Removing the live comparison promotes the oldest saved selection into that slot.
- Current maximum: **8 models selected**, **2 executed per prompt**.
- Never claim 3–8 models are already responding simultaneously. A multi-run
  engine, independent conversation histories, persistence, quotas and per-run
  cancellation are required to execute them all; that backend is not yet built.

The model chips deliberately don't contain any API credentials. An OpenRouter
key can fund requests to different providers, but each actual model call can incur
independent fees.

## Smoke test checklist

- [ ] Existing single model selection still works.
- [ ] Search finds OpenRouter models after the user adds an API key.
- [ ] Selecting a second model yields two distinct model labels.
- [ ] One message yields two real responses, each from its chosen model.
- [ ] Removing comparison returns to single-response mode.
- [ ] Switching chats does not leak a previous chat's compare selection.
- [ ] Built-in API key settings work per provider and never print secrets.
- [ ] Other Docker containers/volumes remain unchanged.

