import { useState } from 'react';
import { Check, Copy, Image as ImageIcon, Info, KeyRound, Plus, Sparkles } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import { useAgentItems } from './Tools/hooks';

/** Use the tool pluginKeys shipped by the server's tools/manifest.json. */
export const MINE_IMAGE_PROVIDER_TOOLS = [
  { id: 'image_gen_oai', title: 'OpenAI Image Tools', hint: 'Generate and edit images. Requires an image-capable OpenAI API key and available credits.' },
  { id: 'gemini_image_gen', title: 'Gemini Image Tools', hint: 'Image generation/editing with Gemini or Vertex AI. Requires provider access.' },
  { id: 'flux', title: 'Flux', hint: 'Cloud image generation. Requires a Flux key and available balance.' },
  { id: 'stable-diffusion', title: 'Stable Diffusion', hint: 'Local/self-hosted Automatic1111 API. Requires a reachable WebUI server.' },
] as const;

type Ratio = 'square' | 'landscape' | 'portrait';
type Quality = 'low' | 'medium' | 'high';

const RATIOS: readonly { id: Ratio; label: string; dimensions: string }[] = [
  { id: 'square', label: 'Square 1:1', dimensions: '1024x1024' },
  { id: 'landscape', label: 'Landscape 3:2', dimensions: '1536x1024' },
  { id: 'portrait', label: 'Portrait 2:3', dimensions: '1024x1536' },
];

export function buildMineImageRequest(
  prompt: string,
  ratio: Ratio = 'square',
  quality: Quality = 'medium',
): string {
  const subject = prompt.trim();
  if (subject.length < 4) {
    return '';
  }
  const size = RATIOS.find((option) => option.id === ratio) ?? RATIOS[0];
  return [
    'Generate ONE image using an enabled, authorized image-generation tool. Do not just write a prompt if a working image tool is available.',
    `Subject and visual direction: ${subject}`,
    `Preferred framing: ${size.label} (${size.dimensions} for a tool that supports this resolution).`,
    `Preferred image quality: ${quality}; use the nearest option supported by the chosen provider.`,
    'Before a paid generation call, make sure the request is within my configured provider access. If the tool or credits are unavailable, do not pretend that you generated an image; explain what needs setup instead.',
    'Preserve my requested details, and do not add a watermark or text unless requested.',
  ].join('\n');
}

/**
 * A permission-aware launchpad that configures an existing Agent's image Tool.
 * Actual generation, files, preview and history continue to use LibreChat's
 * proven Agent runtime and authenticated image storage. No browser-side API keys.
 */
export default function MineImageStudioPilot() {
  const { control, getValues, setValue } = useFormContext<AgentForm>();
  const { catalog } = useAgentItems({ agentId: '' });
  const selectedTools = useWatch({ control, name: 'tools' }) ?? [];
  const [provider, setProvider] = useState<string>('image_gen_oai');
  const [prompt, setPrompt] = useState('A luxury skincare serum bottle on cream marble, soft morning window light, editorial product photography, realistic shadows, minimal composition');
  const [ratio, setRatio] = useState<Ratio>('square');
  const [quality, setQuality] = useState<Quality>('medium');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const selected = MINE_IMAGE_PROVIDER_TOOLS.find((tool) => tool.id === provider) ?? MINE_IMAGE_PROVIDER_TOOLS[0];
  const available = catalog.find((item) => item.kind === 'tool' && item.id === selected.id);
  const added = selectedTools.includes(selected.id);
  const needsSetup = available?.status === 'needs_setup';
  const canAdd = !added && available != null && !needsSetup;

  const addTool = () => {
    // Repeat permission/auth/catalog checks on action; never forge an unavailable
    // server tool or bypass the native Tools marketplace credential dialog.
    const entry = catalog.find((item) => item.kind === 'tool' && item.id === selected.id);
    if (!entry || entry.status === 'needs_setup' || (getValues('tools') ?? []).includes(selected.id)) {
      return;
    }
    setValue('tools', [...new Set([...(getValues('tools') ?? []), selected.id])], {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const request = buildMineImageRequest(prompt, ratio, quality);

  const copyRequest = async () => {
    if (!request) return;
    try {
      await navigator.clipboard.writeText(request);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };

  return (
    <section
      className="border-border-light bg-surface-secondary mt-3 rounded-xl border p-3"
      aria-label="MINE Image Studio setup"
      data-testid="mine-image-studio-pilot"
    >
      <div className="flex items-center gap-2">
        <ImageIcon className="text-text-primary size-4 shrink-0" aria-hidden="true" />
        <span className="text-text-primary text-sm font-semibold">Image Studio V1 — Generate through your Agent</span>
      </div>
      <p className="text-text-secondary mt-1 text-xs leading-5">
        LibreChat already supports image generation in Agent Chat. This setup connects one of its existing tools;
        generated images and downloads appear in Chat after a successful, authorized tool call.
      </p>

      <fieldset className="border-border-light mt-3 rounded-lg border p-2.5">
        <legend className="text-text-primary px-1 text-xs font-semibold">1. Select image provider</legend>
        <div className="mt-1 space-y-1.5">
          {MINE_IMAGE_PROVIDER_TOOLS.map((tool) => {
            const catalogItem = catalog.find((item) => item.kind === 'tool' && item.id === tool.id);
            const isAdded = selectedTools.includes(tool.id);
            return (
              <label
                key={tool.id}
                className="border-border-light bg-surface-primary flex cursor-pointer items-start gap-2 rounded-md border p-2"
              >
                <input
                  type="radio"
                  name="mine-image-provider"
                  className="mt-0.5"
                  checked={provider === tool.id}
                  onChange={() => setProvider(tool.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-text-primary block text-xs font-medium">{tool.title}</span>
                  <span className="text-text-secondary block text-[11px] leading-4">{tool.hint}</span>
                </span>
                <span className="text-text-secondary shrink-0 text-[11px]">
                  {isAdded ? 'Added' : catalogItem == null ? 'Unavailable' : catalogItem.status === 'needs_setup' ? 'Needs setup' : 'Available'}
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-2 flex items-start justify-between gap-2">
          <p className="text-text-secondary text-[11px] leading-4">
            {added
              ? `${selected.title} is added to this Agent draft. API credits and reachability are checked only when used.`
              : needsSetup
                ? 'Set up the selected provider via Tools → Add, then return here.'
                : available == null
                  ? 'This deployment has not made this Tool available. Check Tools → Add or ask an administrator.'
                  : 'This tool is offered by the server. Select Add to stage it in this Agent draft.'}
          </p>
          {added ? (
            <span className="text-text-secondary inline-flex shrink-0 items-center gap-1 text-xs">
              <Check className="text-status-success size-3.5" aria-hidden="true" /> Added
            </span>
          ) : canAdd ? (
            <button
              type="button"
              onClick={addTool}
              className="border-border-light bg-surface-tertiary text-text-primary hover:bg-surface-hover inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium"
              aria-label={`Add ${selected.title} to Agent draft`}
            >
              <Plus className="size-3" aria-hidden="true" /> Add
            </button>
          ) : (
            <span className="text-text-secondary inline-flex shrink-0 items-center gap-1 text-[11px]">
              <KeyRound className="size-3.5" aria-hidden="true" /> {needsSetup ? 'Needs setup' : 'Unavailable'}
            </span>
          )}
        </div>
      </fieldset>

      <div className="mt-3 space-y-2">
        <label htmlFor="mine-image-prompt" className="text-text-primary block text-xs font-semibold">
          2. Describe your image
        </label>
        <textarea
          id="mine-image-prompt"
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setCopied(false);
          }}
          rows={4}
          maxLength={4000}
          className="border-border-light bg-surface-primary text-text-primary w-full resize-y rounded-lg border p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary"
        />
        <div className="flex flex-wrap gap-3">
          <label className="text-text-secondary flex items-center gap-2 text-xs">
            Aspect
            <select
              value={ratio}
              onChange={(event) => { setRatio(event.target.value as Ratio); setCopied(false); }}
              className="border-border-light bg-surface-primary text-text-primary rounded-md border px-2 py-1.5"
              aria-label="Image aspect ratio"
            >
              {RATIOS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-text-secondary flex items-center gap-2 text-xs">
            Quality
            <select
              value={quality}
              onChange={(event) => { setQuality(event.target.value as Quality); setCopied(false); }}
              className="border-border-light bg-surface-primary text-text-primary rounded-md border px-2 py-1.5"
              aria-label="Image quality"
            >
              <option value="low">Draft</option>
              <option value="medium">Standard</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={copyRequest}
          disabled={!request}
          className="bg-surface-tertiary text-text-primary hover:bg-surface-hover inline-flex items-center gap-2 rounded-md border border-border-light px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied image request' : 'Copy image request'}
        </button>
        {copyError && <p className="text-text-secondary text-xs" role="alert">Clipboard permission blocked copying. Please copy your text manually.</p>}
      </div>

      <div className="border-border-light mt-3 flex items-start gap-2 border-t pt-3">
        <Info className="text-text-secondary mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="text-text-secondary text-[11px] leading-5">
          3. Save the Agent, click <strong>Use in Chat</strong>, paste your image request, and send it.
          The configured Agent should invoke its image tool. Images and file controls appear in the existing Chat UI.
          If there is no enabled image tool, missing key, unpaid API credits or an unreachable local server,
          the request cannot render — you can still use the instructions as a creative brief. Tool support for
          resolution/quality varies; nothing is charged merely by configuring this draft.
        </p>
      </div>
      <p className="text-text-secondary mt-2 flex items-center gap-1.5 text-[11px]">
        <Sparkles className="size-3.5" aria-hidden="true" />
        Your text model (including Groq) is separate from the image-generation provider.
      </p>
    </section>
  );
}
