/** @jest-environment jsdom */
import React from 'react';
import { getDefaultStore } from 'jotai';
import { mineTemplateHandoffAtom } from './mineTemplateHandoff';
import { MINE_AGENT_TEMPLATES } from './mineAgentTemplates';
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
jest.mock('./MineImageStudioPilot', () => ({
  __esModule: true,
  default: () => <div data-testid="mine-image-studio-pilot" />,
}));

function AgentFormHarness({
  initialName = '',
  initialInstructions = '',
  agentId = '',
}: {
  initialName?: string;
  initialInstructions?: string;
  agentId?: string;
}) {
  const methods = useForm<AgentForm>({
    defaultValues: {
      id: agentId,
      name: initialName,
      description: '',
      instructionsSource: 'inline',
      instructions: initialInstructions,
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
  beforeEach(() => getDefaultStore().set(mineTemplateHandoffAtom, null));
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

  it('warns that Creative Studio templates need media tools and does not change the model', () => {
    renderQuickStart('/c/new?mineAgentTemplate=image-creator');
    expect(screen.getByText(/Real media output needs a connected image generation tool/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply Marketplace template' }));
    const values = getValues();
    expect(values.name).toBe('AI Image Creator');
    expect(values.instructions).toContain('Without it, provide');
    expect(values.provider).toBe('openai');
    expect(values.model).toBe('test-model');
    expect(screen.getByText(/Setup needed for rendering: image generation tool/)).toBeInTheDocument();
    expect(screen.getByTestId('mine-image-studio-pilot')).toBeInTheDocument();
  });

  it('recovers AI Image Creator selection when Chat removes Marketplace query parameters', () => {
    // Reproduces the Mac screenshot: /c/new is visible but the search parameter
    // from /agents/templates disappeared before the Builder rendered.
    getDefaultStore().set(mineTemplateHandoffAtom, 'image-creator');
    renderQuickStart('/c/new');
    expect(screen.getByText('AI Image Creator')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply Marketplace template' })).toBeInTheDocument();
    expect(getValues().name).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Apply Marketplace template' }));
    expect(getValues().name).toBe('AI Image Creator');
    expect(screen.getByTestId('mine-image-studio-pilot')).toBeInTheDocument();
    expect(getDefaultStore().get(mineTemplateHandoffAtom)).toBeNull();
  });

  it('keeps Image Studio visible after the Builder panel remounts for model selection', () => {
    const image = MINE_AGENT_TEMPLATES.find((template) => template.id === 'image-creator');
    expect(image).toBeDefined();
    // A fresh render without URL or pending atom simulates returning from
    // ModelPanel: the parent React Hook Form retained the applied fields.
    renderQuickStart('/c/new', {
      initialName: image?.name,
      initialInstructions: image?.instructions,
    });
    expect(screen.getByTestId('mine-image-studio-pilot')).toBeInTheDocument();
    expect(screen.getByText(/Setup needed for rendering: image generation tool/)).toBeInTheDocument();
  });

  it('keeps a Marketplace template choice available through confirmation and cancellation', () => {
    getDefaultStore().set(mineTemplateHandoffAtom, 'image-creator');
    renderQuickStart('/c/new', { initialName: 'Unsaved creative draft' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Marketplace template' }));
    expect(getDefaultStore().get(mineTemplateHandoffAtom)).toBe('image-creator');
    fireEvent.click(screen.getByRole('button', { name: 'Keep my work' }));
    expect(getDefaultStore().get(mineTemplateHandoffAtom)).toBe('image-creator');
    fireEvent.click(screen.getByRole('button', { name: 'Apply Marketplace template' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace draft' }));
    expect(getValues().name).toBe('AI Image Creator');
    expect(getDefaultStore().get(mineTemplateHandoffAtom)).toBeNull();
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
