/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import MineAgentQuickStart from './MineAgentQuickStart';
import MineAgentSetupGuide from './MineAgentSetupGuide';

// Quick-start form tests isolate the optional tool trial, which uses separate
// provider permissions and queries verified in its own tests.
jest.mock('./MineResearchPilotTools', () => ({
  __esModule: true,
  default: () => null,
}));

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

const renderQuickStart = (initialEntry = '/c/new', props = {}) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AgentFormHarness {...props} />
    </MemoryRouter>,
  );

describe('MINE Agent quick start via Marketplace', () => {
  it('displays Marketplace link rather than duplicate template cards', () => {
    renderQuickStart();
    expect(screen.getByRole('link', { name: 'Browse Agent Marketplace templates' })).toHaveAttribute(
      'href',
      '/agents/templates',
    );
    expect(screen.queryByRole('button', { name: 'Use Research Agent template' })).not.toBeInTheDocument();
  });

  it('applies selected Marketplace Research template while preserving model and provider', () => {
    renderQuickStart('/c/new?mineAgentTemplate=research');
    expect(getValues().instructions).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Apply Marketplace template' }));
    const values = getValues();
    expect(values.name).toBe('Research Analyst');
    expect(values.instructions).toContain('research partner');
    expect(values.instructionsSource).toBe('inline');
    expect(values.conversation_starters?.length).toBeGreaterThan(0);
    expect(values.provider).toBe('openai');
    expect(values.model).toBe('test-model');
  });

  it('asks before replacing previously entered Agent content', () => {
    renderQuickStart('/c/new?mineAgentTemplate=marketing', { initialName: 'My unfinished draft' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Marketplace template' }));
    expect(getValues().name).toBe('My unfinished draft');
    fireEvent.click(screen.getByRole('button', { name: 'Keep my work' }));
    expect(getValues().name).toBe('My unfinished draft');
    fireEvent.click(screen.getByRole('button', { name: 'Apply Marketplace template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace draft' }));
    expect(getValues().name).toBe('Marketing Strategist');
  });

  it('does not offer quick-start guidance when editing an existing Agent', () => {
    renderQuickStart('/c/new?mineAgentTemplate=research', { agentId: 'agent-123' });
    expect(screen.queryByText('Start with an Agent template')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mine-agent-setup-guide')).not.toBeInTheDocument();
  });
});
