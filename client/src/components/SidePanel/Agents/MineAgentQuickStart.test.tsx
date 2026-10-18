/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import MineAgentQuickStart from './MineAgentQuickStart';
import MineAgentSetupGuide from './MineAgentSetupGuide';

function AgentFormHarness({
  initialName = '',
  agentId = '',
}: {
  initialName?: string;
  agentId?: string;
}) {
  const methods = useForm<AgentForm>({
    defaultValues: {
      id: agentId,
      name: initialName,
      description: '',
      instructionsSource: 'inline',
      instructions: '',
      instructionsPrompt: null,
      conversation_starters: [],
      conversation_starter_draft: '',
      provider: 'openai',
      model: 'test-model',
      model_parameters: {},
      category: 'general',
    },
  });
  const values = useWatch({ control: methods.control });
  return (
    <FormProvider {...methods}>
      <MineAgentQuickStart />
      <MineAgentSetupGuide />
      <output data-testid="agent-form-values">{JSON.stringify(values)}</output>
    </FormProvider>
  );
}

function getValues(): AgentForm {
  return JSON.parse(screen.getByTestId('agent-form-values').textContent || '{}') as AgentForm;
}

describe('MINE Agent quick start', () => {
  it('applies templates to existing form fields, preserving model and provider', () => {
    render(<AgentFormHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Use Research Agent template' }));
    const values = getValues();
    expect(values.name).toBe('Research Analyst');
    expect(values.instructions).toContain('research analyst');
    expect(values.instructionsSource).toBe('inline');
    expect(values.conversation_starters?.length).toBeGreaterThan(0);
    expect(values.provider).toBe('openai');
    expect(values.model).toBe('test-model');
    expect(screen.getByRole('progressbar', { name: 'Agent setup progress' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    );
  });

  it('asks before replacing previously entered Agent content', () => {
    render(<AgentFormHarness initialName="My unfinished draft" />);
    fireEvent.click(screen.getByRole('button', { name: 'Use Marketing Agent template' }));
    expect(getValues().name).toBe('My unfinished draft');
    fireEvent.click(screen.getByRole('button', { name: 'Keep my work' }));
    expect(getValues().name).toBe('My unfinished draft');

    fireEvent.click(screen.getByRole('button', { name: 'Use Marketing Agent template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace draft' }));
    expect(getValues().name).toBe('Marketing Strategist');
  });

  it('does not offer quick-start or setup guide when editing an existing Agent', () => {
    render(<AgentFormHarness agentId="agent-123" />);
    expect(screen.queryByText('Start with an Agent template')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mine-agent-setup-guide')).not.toBeInTheDocument();
  });
});
