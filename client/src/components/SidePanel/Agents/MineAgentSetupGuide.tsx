import { Check, Circle, Info } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentForm, StringOption } from '~/common';
import { isRestrictedInstructionsPrompt } from './instructionsPromptUtils';

/**
 * Lightweight configuration checklist. This is guidance, not a replacement for
 * the existing server-side validation or proof that a model key is connected.
 */
export default function MineAgentSetupGuide() {
  const { control } = useFormContext<AgentForm>();
  const agentId = useWatch({ control, name: 'id' });
  const name = useWatch({ control, name: 'name' });
  const model = useWatch({ control, name: 'model' });
  const providerOption = useWatch({ control, name: 'provider' });
  const instructions = useWatch({ control, name: 'instructions' });
  const instructionsSource = useWatch({ control, name: 'instructionsSource' });
  const instructionsPrompt = useWatch({ control, name: 'instructionsPrompt' });
  const starters = useWatch({ control, name: 'conversation_starters' });

  if (agentId) {
    return null;
  }

  const provider =
    typeof providerOption === 'string'
      ? providerOption
      : ((providerOption as StringOption | undefined)?.value ?? '');
  const promptConfigured =
    instructionsPrompt != null &&
    !isRestrictedInstructionsPrompt(instructionsPrompt) &&
    Boolean(instructionsPrompt.groupId);
  const tasks = [
    { label: 'Agent name', done: Boolean(name?.trim()) },
    { label: 'Provider & model', done: Boolean(provider && model?.trim()) },
    {
      label: 'Instructions',
      done:
        instructionsSource === 'prompt' ? promptConfigured : Boolean(instructions?.trim()),
    },
  ];
  const completed = tasks.filter((task) => task.done).length;

  return (
    <section
      className="border-border-light mb-3 rounded-xl border p-3"
      aria-label="MINE Agent setup checklist"
      data-testid="mine-agent-setup-guide"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-primary text-xs font-semibold">Agent setup</span>
        <span className="text-text-secondary text-xs" aria-label={completed + ' of 3 basics configured'}>
          {completed}/3 basics
        </span>
      </div>
      <div
        className="bg-surface-tertiary mt-2 h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Agent setup progress"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={3}
      >
        <div
          className="bg-text-primary h-full rounded-full transition-[width] duration-200"
          style={{ width: (completed / 3) * 100 + '%' }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
        {tasks.map((task) => (
          <span
            key={task.label}
            className="text-text-secondary inline-flex items-center gap-1.5 text-xs"
          >
            {task.done ? (
              <Check className="text-status-success size-3.5" aria-hidden="true" />
            ) : (
              <Circle className="size-3.5" aria-hidden="true" />
            )}
            {task.label}
          </span>
        ))}
      </div>
      <p className="text-text-secondary mt-3 flex items-start gap-1.5 text-xs leading-5">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {completed === 3
            ? 'Basic setup is complete. Create your Agent to enable saved Agent features.'
            : 'Complete the missing basics above. Tools and skills are optional.'}
          {' '}File Context uploads require creating the Agent first.
          {(starters?.length ?? 0) > 0 && ' Conversation starters will be saved with it.'}
          {' '}Model API access and tool permissions must also be configured.
        </span>
      </p>
    </section>
  );
}
