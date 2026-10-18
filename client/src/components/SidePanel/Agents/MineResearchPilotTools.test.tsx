/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import MineResearchPilotTools from './MineResearchPilotTools';

type MockBuiltin = {
  kind: 'builtin';
  id: string;
  name: string;
  iconKey: string;
  description: string;
  status?: 'needs_setup';
};

let mockCatalog: MockBuiltin[] = [];
jest.mock('./Tools/hooks', () => ({
  useAgentItems: () => ({ catalog: mockCatalog, selected: [], tools: [] }),
}));

function makeTool(id: string, status?: 'needs_setup'): MockBuiltin {
  return { kind: 'builtin', id, iconKey: id, name: id, description: id, status };
}

function FormHarness() {
  const methods = useForm<AgentForm>({
    defaultValues: {
      id: '',
      name: 'Research Analyst',
      description: '',
      instructionsSource: 'inline',
      instructions: '',
      instructionsPrompt: null,
      category: 'general',
      model: 'test-model',
      provider: 'openai',
      model_parameters: {},
      tools: [],
      web_search: false,
      file_search: false,
    },
  });
  const values = useWatch({ control: methods.control });
  return (
    <FormProvider {...methods}>
      <MineResearchPilotTools />
      <output data-testid="pilot-form-values">{JSON.stringify(values)}</output>
    </FormProvider>
  );
}

const getValues = (): AgentForm =>
  JSON.parse(screen.getByTestId('pilot-form-values').textContent || '{}') as AgentForm;

describe('MINE Research Pilot Tools', () => {
  beforeEach(() => {
    mockCatalog = [
      makeTool('ask_user_question'),
      makeTool('web_search', 'needs_setup'),
      makeTool('file_search'),
    ];
  });

  it('does not attach any tools on mount or on Research selection alone', () => {
    render(<FormHarness />);
    expect(getValues().tools).toEqual([]);
    expect(getValues().web_search).toBe(false);
    expect(getValues().file_search).toBe(false);
  });

  it('adds only tools explicitly approved in the UI', () => {
    render(<FormHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Ask User to Agent draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add File Search to Agent draft' }));

    expect(getValues().tools).toEqual(['ask_user_question']);
    expect(getValues().file_search).toBe(true);
    expect(getValues().web_search).toBe(false);
  });

  it('does not offer the enable button for a tool missing an API credential', () => {
    render(<FormHarness />);
    expect(screen.getByText('Needs setup')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Web Search to Agent draft' })).toBeNull();
  });

  it('allows Web Search only when the filtered catalog considers it ready', () => {
    mockCatalog = [makeTool('web_search')];
    render(<FormHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Web Search to Agent draft' }));
    expect(getValues().web_search).toBe(true);
    expect(getValues().tools).toEqual([]);
  });

  it('does not show an enable button for tools absent due to permissions', () => {
    mockCatalog = [];
    render(<FormHarness />);
    expect(screen.queryByRole('button', { name: 'Add Ask User to Agent draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add File Search to Agent draft' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Web Search to Agent draft' })).toBeNull();
  });
});
