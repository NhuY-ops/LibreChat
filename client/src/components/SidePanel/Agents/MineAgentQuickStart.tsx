import { useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Link, useSearchParams } from 'react-router-dom';
import { Constants } from 'librechat-data-provider';
import { ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import { MINE_AGENT_TEMPLATES } from './mineAgentTemplates';
import type { MineAgentTemplate } from './mineAgentTemplates';
import MineResearchPilotTools from './MineResearchPilotTools';
import MineImageStudioPilot from './MineImageStudioPilot';
import { mineTemplateHandoffAtom, mineTemplateBuilderSessionAtom } from './mineTemplateHandoff';

/**
 * Starter templates for unsaved Agents only. Nothing executes or creates an
 * Agent until the existing React Hook Form submit handler succeeds.
 * The selected provider/model and existing tools/skills are never changed.
 */
export default function MineAgentQuickStart() {
  const { control, getValues, setValue } = useFormContext<AgentForm>();
  const agentId = useWatch({ control, name: 'id' });
  const [searchParams] = useSearchParams();
  const [handoffId, setHandoffId] = useAtom(mineTemplateHandoffAtom);
  const builderSessionId = useAtomValue(mineTemplateBuilderSessionAtom);
  const [expanded, setExpanded] = useState(true);
  const [pending, setPending] = useState<MineAgentTemplate | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const formName = useWatch({ control, name: 'name' });
  const formInstructions = useWatch({ control, name: 'instructions' });
  // AgentConfig unmounts when the user switches into the model/settings panel.
  // Recover already-applied templates from the still-live React Hook Form,
  // rather than losing the Image Studio setup when the user comes back.
  const appliedTemplateId = MINE_AGENT_TEMPLATES.find(
    (template) => template.name === formName && template.instructions === formInstructions,
  )?.id;
  const activeTemplateId = builderSessionId ?? appliedTemplateId ?? selectedTemplateId;
  // Chat routing can strip the original URL query. Handoff state is the
  // primary pending selection, and the draft itself is the post-apply source.
  const requestedId = handoffId ?? searchParams.get('mineAgentTemplate') ?? activeTemplateId;
  const requestedTemplate = MINE_AGENT_TEMPLATES.find((template) => template.id === requestedId);

  if (agentId) {
    return null;
  }

  const apply = (template: MineAgentTemplate) => {
    setValue('name', template.name, { shouldDirty: true, shouldValidate: true });
    setValue('description', template.description, { shouldDirty: true, shouldValidate: true });
    setValue('instructionsSource', 'inline', { shouldDirty: true, shouldValidate: true });
    setValue('instructionsPrompt', null, { shouldDirty: true, shouldValidate: true });
    setValue('instructions', template.instructions, { shouldDirty: true, shouldValidate: true });
    setValue('conversation_starters', template.starters.slice(0, Constants.MAX_CONVO_STARTERS), {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue('conversation_starter_draft', '', { shouldDirty: false });
    setSelectedTemplateId(template.id);
    setPending(null);
    // Consume only after an explicit successful form fill. Until then a route
    // change or Agent panel remount must not silently lose the selection.
    setHandoffId(null);
  };

  const choose = (template: MineAgentTemplate) => {
    const current = getValues();
    const hasDraft = Boolean(
      current.name?.trim() ||
        current.description?.trim() ||
        current.instructions?.trim() ||
        (current.conversation_starters?.length ?? 0) > 0 ||
        current.instructionsSource === 'prompt',
    );
    if (hasDraft) {
      setPending(template);
      return;
    }
    apply(template);
  };

  return (
    <section className="border-border-light bg-surface-secondary mb-3 rounded-xl border p-2.5">
      <button
        type="button"
        className="text-text-primary flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((value) => !value);
          setPending(null);
        }}
      >
        <span className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="size-4" aria-hidden="true" />
          Start with an Agent template
        </span>
        {expanded ? (
          <ChevronUp className="text-text-secondary size-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="text-text-secondary size-4" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div className="mt-2">
          <p className="text-text-secondary mb-2 text-xs">
            Browse curated Agent Templates in the Agent Marketplace, then configure the selected
            template here. Your model, keys, Tools and knowledge files stay under your control.
          </p>
          {requestedTemplate ? (
            <div className="border-border-light bg-surface-primary rounded-lg border p-2.5" role="group" aria-label="Selected Marketplace Agent template">
              <p className="text-text-primary text-xs font-semibold">{requestedTemplate.name}</p>
              <p className="text-text-secondary mt-1 text-xs">{requestedTemplate.description}</p>
              {requestedTemplate.requiredTool && (
                <p className="text-text-secondary mt-1 text-xs" role="note">
                  Real media output needs a connected {requestedTemplate.requiredTool}.
                  This blueprint only supplies instructions until a compatible Tool is configured.
                </p>
              )}
              {activeTemplateId === requestedTemplate.id ? (
                <p className="text-text-primary mt-2 rounded-md bg-surface-tertiary px-2.5 py-2 text-xs font-medium" role="status">
                  ✓ {requestedTemplate.name} loaded into a NEW Agent draft. Choose a model and configure Tools below.
                  The Chat on the right can still show your previous Agent until you save this one and use it in Chat.
                </p>
              ) : (
                <button
                  type="button"
                  className="bg-surface-tertiary text-text-primary hover:bg-surface-hover mt-2 rounded-md px-2.5 py-1.5 text-xs font-medium"
                  onClick={() => choose(requestedTemplate)}
                >
                  Apply Marketplace template
                </button>
              )}
            </div>
          ) : (
            <Link
              to="/agents/templates"
              className="border-border-light bg-surface-primary text-text-primary hover:bg-surface-hover inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium"
            >
              Browse Agent Marketplace templates
            </Link>
          )}
          {activeTemplateId === 'research' && <MineResearchPilotTools />}
          {activeTemplateId === 'image-creator' && <MineImageStudioPilot />}
          {activeTemplateId && requestedTemplate?.id === activeTemplateId && requestedTemplate.requiredTool && (
            <p className="text-text-secondary mt-2 text-xs" role="note">
              Setup needed for rendering: {requestedTemplate.requiredTool}. Use Tools → Add to
              connect a compatible service yourself; saving this Agent does not provision it.
            </p>
          )}

          {pending && (
            <div
              className="border-border-medium bg-surface-primary mt-2 rounded-lg border p-2"
              role="group"
              aria-label="Confirm Agent template replacement"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-text-primary text-xs">
                  Replace your current name, description, instructions and starters with
                  the <strong>{pending.title}</strong> template?
                </p>
                <button
                  type="button"
                  className="text-text-secondary hover:text-text-primary shrink-0"
                  aria-label="Cancel template replacement"
                  onClick={() => setPending(null)}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="border-border-light bg-surface-tertiary text-text-primary rounded-md border px-2.5 py-1.5 text-xs font-medium"
                  onClick={() => {
                    if (pending) {
                      apply(pending);
                    }
                  }}
                >
                  Replace draft
                </button>
                <button
                  type="button"
                  className="text-text-secondary rounded-md px-2 py-1.5 text-xs"
                  onClick={() => setPending(null)}
                >
                  Keep my work
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
