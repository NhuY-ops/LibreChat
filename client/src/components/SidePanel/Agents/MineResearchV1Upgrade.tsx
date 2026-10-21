import { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import { isEphemeralAgent } from '~/common';
import { MINE_RESEARCH_V1_INSTRUCTIONS } from './mineAgentTemplates';

/**
 * An opt-in path for Research Analysts created before V1 shipped.
 * Only the inline instructions field can change, and only after explicit
 * confirmation; the user must still press the normal Save button.
 * No tools, provider/model, files, credentials, starters or permissions change.
 */
export default function MineResearchV1Upgrade() {
  const { control, setValue } = useFormContext<AgentForm>();
  const agentId = useWatch({ control, name: 'id' });
  const name = useWatch({ control, name: 'name' });
  const instructionsSource = useWatch({ control, name: 'instructionsSource' });
  const instructions = useWatch({ control, name: 'instructions' });
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setConfirming(false);
  }, [agentId]);

  if (!agentId || isEphemeralAgent(agentId) || name?.trim() !== 'Research Analyst') {
    return null;
  }

  const isCurrent = instructionsSource === 'inline' && instructions === MINE_RESEARCH_V1_INSTRUCTIONS;

  return (
    <section
      className="border-border-light bg-surface-secondary mb-3 rounded-lg border px-3 py-2.5"
      aria-label="Research Analyst V1 instructions"
    >
      <div className="flex items-center gap-2">
        {isCurrent ? (
          <CheckCircle2 className="text-status-success size-4 shrink-0" aria-hidden="true" />
        ) : (
          <Sparkles className="text-text-secondary size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="text-text-primary text-xs font-semibold">
          {isCurrent ? 'Research V1 instructions in editor' : 'Research Analyst V1'}
        </span>
      </div>
      <p className="text-text-secondary mt-1 text-[11px] leading-4">
        Better study planning, relevant literature, source verification, evidence synthesis and academic writing.
      </p>
      {isCurrent ? (
        <p className="text-text-secondary mt-2 text-[11px]">
          Press Save to persist any unsaved instruction changes.
        </p>
      ) : instructionsSource !== 'inline' ? (
        <p className="text-text-secondary mt-2 text-[11px]" role="status">
          This Agent uses linked Prompt instructions. Switch to Inline if you want to replace them;
          this upgrade will not unlink a Prompt automatically.
        </p>
      ) : !confirming ? (
        <button
          type="button"
          className="border-border-light bg-surface-primary text-text-primary hover:bg-surface-hover mt-2 rounded-md border px-2.5 py-1.5 text-xs font-medium"
          onClick={() => setConfirming(true)}
        >
          Review V1 upgrade
        </button>
      ) : (
        <div className="border-border-medium bg-surface-primary mt-2 rounded-lg border p-2" role="group" aria-label="Confirm Research V1 instructions upgrade">
          <p className="text-text-primary text-xs">
            Replace this Agent's current inline instructions with Research V1? Existing
            instructions will be overwritten. Model, Tools, keys, knowledge files and
            conversation starters will not change. You must press Save afterward.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="bg-surface-tertiary text-text-primary hover:bg-surface-hover rounded-md px-2.5 py-1.5 text-xs font-medium"
              onClick={() => {
                setValue('instructions', MINE_RESEARCH_V1_INSTRUCTIONS, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
                setConfirming(false);
              }}
            >
              Replace instructions
            </button>
            <button
              type="button"
              className="text-text-secondary hover:text-text-primary rounded-md px-2.5 py-1.5 text-xs"
              onClick={() => setConfirming(false)}
            >
              Keep current
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
