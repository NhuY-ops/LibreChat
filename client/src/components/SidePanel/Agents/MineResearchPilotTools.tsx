import { Check, Info, LockKeyhole, Plus, TestTube2 } from 'lucide-react';
import { AgentCapabilities } from 'librechat-data-provider';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import { useAgentItems } from './Tools/hooks';

/**
 * One deliberately small production-form experiment: recommended Research tools.
 *
 * The same permission- and authentication-filtered catalog as Tool Library
 * decides whether each item may be offered. A click only updates the Agent
 * draft; the regular Create submission still validates and persists it.
 * Nothing is enabled when selecting the Research template.
 */
const PILOT_TOOLS = [
  {
    id: 'ask_user_question',
    name: 'Ask User',
    description: 'Pause to ask for missing research scope or requirements.',
  },
  {
    id: AgentCapabilities.web_search,
    name: 'Web Search',
    description: 'Research recent, verifiable information (may need an API key).',
  },
  {
    id: AgentCapabilities.file_search,
    name: 'File Search',
    description: 'Retrieve information from uploaded Agent knowledge files.',
  },
] as const;

export default function MineResearchPilotTools() {
  const { control, getValues, setValue } = useFormContext<AgentForm>();
  const { catalog } = useAgentItems({ agentId: '' });
  const selectedTools = useWatch({ control, name: 'tools' }) ?? [];
  const webSearch = useWatch({ control, name: 'web_search' });
  const fileSearch = useWatch({ control, name: 'file_search' });

  const isSelected = (id: string): boolean => {
    if (id === AgentCapabilities.web_search) {
      return webSearch === true;
    }
    if (id === AgentCapabilities.file_search) {
      return fileSearch === true;
    }
    return selectedTools.includes(id);
  };

  const add = (id: string) => {
    // Re-check current availability at action time; don't bypass Tool Library
    // permissions or a required configuration screen.
    const item = catalog.find((entry) => entry.kind === 'builtin' && entry.id === id);
    if (!item || item.status === 'needs_setup' || isSelected(id)) {
      return;
    }

    if (id === AgentCapabilities.web_search) {
      setValue('web_search', true, { shouldDirty: true, shouldValidate: true });
    } else if (id === AgentCapabilities.file_search) {
      setValue('file_search', true, { shouldDirty: true, shouldValidate: true });
    } else if (id === 'ask_user_question') {
      const current = getValues('tools') ?? [];
      setValue('tools', Array.from(new Set([...current, id])), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  return (
    <section
      className="border-border-light mt-3 rounded-xl border p-3"
      aria-label="Research pilot tool recommendations"
      data-testid="mine-research-pilot-tools"
    >
      <div className="flex items-start gap-2">
        <TestTube2 className="text-text-secondary mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-text-primary text-xs font-semibold">Research Pilot — Test these tools</p>
          <p className="text-text-secondary mt-1 text-xs leading-5">
            Tools are optional. Enable them individually after reviewing access.
            Selecting this template never connects an account or sends a request.
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {PILOT_TOOLS.map((tool) => {
          const available = catalog.find(
            (item) => item.kind === 'builtin' && item.id === tool.id,
          );
          const selected = isSelected(tool.id);
          const needsSetup = available?.status === 'needs_setup';
          return (
            <li
              key={tool.id}
              className="border-border-light flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-text-primary text-xs font-medium">{tool.name}</p>
                <p className="text-text-secondary mt-0.5 text-[11px] leading-4">
                  {tool.description}
                </p>
              </div>
              {selected ? (
                <span className="text-text-secondary inline-flex shrink-0 items-center gap-1 text-xs">
                  <Check className="text-status-success size-3.5" aria-hidden="true" />
                  Added
                </span>
              ) : available == null || needsSetup ? (
                <span className="text-text-secondary inline-flex max-w-24 shrink-0 items-center gap-1 text-right text-[11px]">
                  <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
                  {needsSetup ? 'Needs setup' : 'Unavailable'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => add(tool.id)}
                  aria-label={'Add ' + tool.name + ' to Agent draft'}
                  className="border-border-light bg-surface-tertiary text-text-primary hover:bg-surface-hover inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1.5 text-xs"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  Add
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-text-secondary mt-3 flex items-start gap-1.5 text-[11px] leading-5">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          If a tool needs setup, use Tools → Add in the editor. File Search also needs
          a saved Agent with knowledge files; Web Search needs valid credentials.
          Only a live Chat run can confirm actual tool execution.
        </span>
      </p>
    </section>
  );
}
