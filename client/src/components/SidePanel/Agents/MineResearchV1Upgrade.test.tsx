/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import MineResearchV1Upgrade from './MineResearchV1Upgrade';
import { MINE_RESEARCH_V1_INSTRUCTIONS } from './mineAgentTemplates';

function Harness({
  agentId = 'saved-research-agent',
  agentName = 'Research Analyst',
  source = 'inline',
}: {
  agentId?: string;
  agentName?: string;
  source?: AgentForm['instructionsSource'];
}) {
  const methods = useForm<AgentForm>({
    defaultValues: {
      id: agentId,
      name: agentName,
      description: 'My existing description',
      instructions: 'Keep my custom instructions until confirmed.',
      instructionsSource: source,
      instructionsPrompt: source === 'prompt' ? 'stored-prompt-id' : null,
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      tools: ['ask_user_question'],
      conversation_starters: ['My current starter'],
    } as AgentForm,
  });
  const values = useWatch({ control: methods.control });

  return (
    <FormProvider {...methods}>
      <MineResearchV1Upgrade />
      <output data-testid="research-v1-values">{JSON.stringify(values)}</output>
    </FormProvider>
  );
}

const fields = (): AgentForm =>
  JSON.parse(screen.getByTestId('research-v1-values').textContent || '{}') as AgentForm;

describe('Research V1 upgrade for saved Agents', () => {
  it('does not touch a saved Research Agent until explicit confirmation', () => {
    render(<Harness />);
    expect(fields().instructions).toBe('Keep my custom instructions until confirmed.');
    fireEvent.click(screen.getByRole('button', { name: 'Review V1 upgrade' }));
    expect(fields().instructions).toBe('Keep my custom instructions until confirmed.');
    fireEvent.click(screen.getByRole('button', { name: 'Keep current' }));
    expect(fields().instructions).toBe('Keep my custom instructions until confirmed.');
  });

  it('stages only V1 inline instructions, retaining model, tools and starters', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Review V1 upgrade' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace instructions' }));
    expect(fields().instructions).toBe(MINE_RESEARCH_V1_INSTRUCTIONS);
    expect(fields().provider).toBe('groq');
    expect(fields().model).toBe('openai/gpt-oss-20b');
    expect(fields().tools).toEqual(['ask_user_question']);
    expect(fields().conversation_starters).toEqual(['My current starter']);
    expect(fields().description).toBe('My existing description');
    expect(screen.getByText('Research V1 instructions in editor')).toBeInTheDocument();
  });

  it('never unlinks saved Prompt-based instructions without user action', () => {
    render(<Harness source="prompt" />);
    expect(screen.getByText(/Switch to Inline/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review V1 upgrade' })).not.toBeInTheDocument();
    expect(fields().instructionsSource).toBe('prompt');
    expect(fields().instructionsPrompt).toBe('stored-prompt-id');
  });

  it('does not offer the upgrade to unsaved Agents', () => {
    render(<Harness agentId="" />);
    expect(screen.queryByRole('button', { name: 'Review V1 upgrade' })).not.toBeInTheDocument();
  });

  it('does not offer the upgrade to unrelated saved Agents', () => {
    render(<Harness agentId="saved-coder" agentName="Software Engineering Partner" />);
    expect(screen.queryByRole('button', { name: 'Review V1 upgrade' })).not.toBeInTheDocument();
  });
});
