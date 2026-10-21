import React from 'react';
import { getDefaultStore } from 'jotai';
import { mineTemplateBuilderSessionAtom } from '../mineTemplateHandoff';
import { useForm, FormProvider } from 'react-hook-form';
import { act, render, waitFor } from '@testing-library/react';
import type { UseMutationResult, QueryObserverResult } from '@tanstack/react-query';
import type { Agent, AgentCreateParams } from 'librechat-data-provider';
import type { UseFormReturn } from 'react-hook-form';
import type { AgentForm } from '~/common';
import AgentSelect from '../AgentSelect';

jest.mock('~/data-provider', () => ({
  useListAgentsQuery: () => ({ data: [] }),
  useGetStartupConfig: () => ({ data: undefined }),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useAgentDefaultPermissionLevel: () => 1,
}));

jest.mock('@librechat/client', () => ({
  ControlCombobox: () => <div data-testid="agent-select-combobox" />,
}));

/**
 * Renders `AgentSelect` with an already-successful `agentQuery`, which drives its
 * `resetAgentForm` load effect the same way selecting an agent (or a background
 * refetch) does. `resetAgentForm` is a closure, not exported, so this is the
 * narrowest seam that observes its instructions-source/instructions-prompt mapping.
 */
function Harness({
  agent,
  onMethods,
  instructionsPromptReady,
  defaultValues,
  selectedAgentId,
  setCurrentAgentId,
}: {
  agent: Agent;
  onMethods: (methods: UseFormReturn<AgentForm>) => void;
  instructionsPromptReady?: boolean;
  defaultValues?: Partial<AgentForm>;
  selectedAgentId?: string | null;
  setCurrentAgentId?: jest.Mock;
}) {
  const methods = useForm<AgentForm>({ defaultValues });
  onMethods(methods);

  return (
    <FormProvider {...methods}>
      <AgentSelect
        agentQuery={{ data: agent, isSuccess: true } as unknown as QueryObserverResult<Agent>}
        /** The list query is empty in this test; a matching saved query can
         * still hydrate directly without a synthetic selector click. */
        selectedAgentId={selectedAgentId === undefined ? agent.id : selectedAgentId}
        setCurrentAgentId={setCurrentAgentId ?? jest.fn()}
        createMutation={
          { reset: jest.fn() } as unknown as UseMutationResult<Agent, Error, AgentCreateParams>
        }
        defaultStatefulCodeEnvironment="user"
        instructionsPromptReady={instructionsPromptReady}
      />
    </FormProvider>
  );
}

const createAgent = (overrides: Partial<Agent> = {}): Agent =>
  ({
    id: 'agent_1',
    name: 'Agent',
    provider: 'openai',
    model: 'gpt-4',
    ...overrides,
  }) as Agent;

describe('AgentSelect resetAgentForm', () => {
  beforeEach(() => getDefaultStore().set(mineTemplateBuilderSessionAtom, null));
  it('does not restore a cached Research Agent over the Image Creator template draft', async () => {
    getDefaultStore().set(mineTemplateBuilderSessionAtom, 'image-creator');
    let methods: UseFormReturn<AgentForm> | undefined;
    render(
      <Harness
        agent={createAgent({ name: 'Research Analyst V1', instructions: 'Old research setup' })}
        defaultValues={{
          name: 'AI Image Creator',
          instructions: 'New image generation Agent instructions',
          instructionsSource: 'inline',
        }}
        onMethods={(m) => (methods = m)}
      />,
    );

    await waitFor(() => expect(methods?.getValues('name')).toBe('AI Image Creator'));
    expect(methods?.getValues('instructions')).toBe('New image generation Agent instructions');
    expect(methods?.getValues('instructionsSource')).toBe('inline');
  });

  it('does not hydrate a stale Research query over a new unsaved Image Creator draft', async () => {
    let methods: UseFormReturn<AgentForm> | undefined;
    render(
      <Harness
        agent={createAgent({ id: 'old_research', name: 'Research Analyst V1', instructions: 'Research' })}
        selectedAgentId={null}
        defaultValues={{ id: '', name: 'AI Image Creator', instructions: 'Image Studio V1' }}
        onMethods={(m) => (methods = m)}
      />,
    );

    expect(methods?.getValues('name')).toBe('AI Image Creator');
    expect(methods?.getValues('instructions')).toBe('Image Studio V1');
  });

  it('does not clear a newly saved Image Creator while the agent list and query are stale', async () => {
    let methods: UseFormReturn<AgentForm> | undefined;
    const setCurrentAgentId = jest.fn();
    render(
      <Harness
        agent={createAgent({ id: 'old_research', name: 'Research Analyst V1', instructions: 'Research' })}
        selectedAgentId="new_image_agent"
        setCurrentAgentId={setCurrentAgentId}
        defaultValues={{ id: 'new_image_agent', name: 'AI Image Creator', instructions: 'Image Studio V1' }}
        onMethods={(m) => (methods = m)}
      />,
    );

    // Previous selector code scheduled an automatic "not found" selection
    // after 5ms, resetting the newly saved Agent to Create New Agent.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(setCurrentAgentId).not.toHaveBeenCalledWith(undefined);
    expect(methods?.getValues('id')).toBe('new_image_agent');
    expect(methods?.getValues('name')).toBe('AI Image Creator');
    expect(methods?.getValues('instructions')).toBe('Image Studio V1');
  });

  it('maps a linked agent to Prompt mode with the link copied verbatim', async () => {
    const link = {
      source: 'native' as const,
      groupId: 'group_1',
      selection: { type: 'production' as const },
    };
    let methods: UseFormReturn<AgentForm> | undefined;

    render(
      <Harness
        agent={createAgent({ instructionsPrompt: link })}
        onMethods={(m) => (methods = m)}
      />,
    );

    await waitFor(() => expect(methods?.getValues('instructionsSource')).toBe('prompt'));
    expect(methods?.getValues('instructionsPrompt')).toEqual(link);
  });

  it('maps a restricted stub to Prompt mode with the stub preserved', async () => {
    const stub = { source: 'native' as const, restricted: true as const };
    let methods: UseFormReturn<AgentForm> | undefined;

    render(
      <Harness
        agent={createAgent({ instructionsPrompt: stub })}
        onMethods={(m) => (methods = m)}
      />,
    );

    await waitFor(() => expect(methods?.getValues('instructionsSource')).toBe('prompt'));
    expect(methods?.getValues('instructionsPrompt')).toEqual(stub);
  });

  it('maps an agent with no link to Inline mode with a null prompt', async () => {
    let methods: UseFormReturn<AgentForm> | undefined;

    render(
      <Harness
        agent={createAgent({ instructionsPrompt: null })}
        onMethods={(m) => (methods = m)}
      />,
    );

    await waitFor(() => expect(methods?.getValues('instructionsSource')).toBe('inline'));
    expect(methods?.getValues('instructionsPrompt')).toBeNull();
  });

  it('keeps the form instructions-source/prompt untouched when the data is the basic projection', async () => {
    let methods: UseFormReturn<AgentForm> | undefined;

    render(
      <Harness
        /** No `instructionsPrompt` key at all, as the basic agent projection sends it. */
        agent={createAgent()}
        instructionsPromptReady={false}
        defaultValues={{
          instructionsSource: 'prompt',
          instructionsPrompt: {
            source: 'native',
            groupId: 'group_1',
            selection: { type: 'production' },
          },
        }}
        onMethods={(m) => (methods = m)}
      />,
    );

    await waitFor(() => expect(methods?.getValues('name')).toBe('Agent'));
    expect(methods?.getValues('instructionsSource')).toBe('prompt');
    expect(methods?.getValues('instructionsPrompt')).toEqual({
      source: 'native',
      groupId: 'group_1',
      selection: { type: 'production' },
    });
  });
});
