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

## Compare (currently 2 models)

1. Choose a primary provider/model from **Select a model**.
2. Open the dropdown and click **Compare +**.
3. Choose a *different* model, including a model from OpenRouter.
4. The second model appears next to the primary model in the header.
5. Send a prompt through LibreChat's composer; LibreChat's built-in second
   response state handles parallel replies. Use **X** to remove the comparison.
6. Use **Done** to leave comparison selection mode and return to normal
   single-model selection.

**Important limitation:** LibreChat's current `multiConvo` front end has
only two response panes. This implementation intentionally limits comparison
to two live models. Supporting 3+ parallel requests requires a separate
refactor of composer, response panes, submission state and history. Merely
adding additional checkboxes would falsely promise working comparisons.

## Smoke test checklist

- [ ] Existing single model selection still works.
- [ ] Search finds OpenRouter models after the user adds an API key.
- [ ] Selecting a second model yields two distinct model labels.
- [ ] One message yields two real responses, each from its chosen model.
- [ ] Removing comparison returns to single-response mode.
- [ ] Switching chats does not leak a previous chat's compare selection.
- [ ] Built-in API key settings work per provider and never print secrets.
- [ ] Other Docker containers/volumes remain unchanged.

