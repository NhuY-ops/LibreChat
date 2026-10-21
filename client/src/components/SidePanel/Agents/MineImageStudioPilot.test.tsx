/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import type { AgentForm } from '~/common';
import MineImageStudioPilot, { buildMineImageRequest, MINE_IMAGE_PROVIDER_TOOLS } from './MineImageStudioPilot';

const mockCatalog: Array<{
  kind: 'tool';
  id: string;
  name: string;
  status?: 'needs_setup';
}> = [
  { kind: 'tool', id: 'image_gen_oai', name: 'OpenAI Image Tools' },
  { kind: 'tool', id: 'gemini_image_gen', name: 'Gemini Image Tools', status: 'needs_setup' },
];

jest.mock('./Tools/hooks', () => ({
  useAgentItems: () => ({ catalog: mockCatalog, selected: [], tools: [] }),
}));

function Harness({ tools = [], name = 'AI Image Creator' }: { tools?: string[]; name?: string }) {
  const methods = useForm<AgentForm>({
    defaultValues: {
      id: '',
      name,
      tools,
      model: 'openai/gpt-oss-20b',
      provider: 'groq',
    } as AgentForm,
  });
  const values = useWatch({ control: methods.control });
  return (
    <FormProvider {...methods}>
      <MineImageStudioPilot />
      <output data-testid="form-values">{JSON.stringify(values)}</output>
    </FormProvider>
  );
}

const fields = (): AgentForm => JSON.parse(screen.getByTestId('form-values').textContent || '{}') as AgentForm;

describe('MINE Image Studio V1 launchpad', () => {
  it('uses only the image plugin ids supported by the server manifest', () => {
    expect(MINE_IMAGE_PROVIDER_TOOLS.map((item) => item.id)).toEqual([
      'image_gen_oai', 'gemini_image_gen', 'flux', 'stable-diffusion',
    ]);
  });

  it('constructs a one-image request with selected framing without claiming output', () => {
    const prompt = buildMineImageRequest('a luxury skincare bottle', 'portrait', 'high');
    expect(prompt).toContain('Generate ONE image using an enabled');
    expect(prompt).toContain('1024x1536');
    expect(prompt).toContain('quality: high');
    expect(prompt).toContain('do not pretend that you generated an image');
    expect(buildMineImageRequest('   ')).toBe('');
  });

  it('only stages a tool explicitly and never changes Groq model or credentials', () => {
    render(<Harness tools={['ask_user_question']} />);
    expect(fields().tools).toEqual(['ask_user_question']);
    fireEvent.click(screen.getByRole('button', { name: 'Add OpenAI Image Tools to Agent draft' }));
    expect(fields().tools).toEqual(['ask_user_question', 'image_gen_oai']);
    expect(fields().provider).toBe('groq');
    expect(fields().model).toBe('openai/gpt-oss-20b');
    expect(screen.getByText(/API credits and reachability are checked only when used/)).toBeInTheDocument();
  });

  it('does not add tools that need authentication and tells users to use Tool Library', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: /Gemini Image Tools/ }));
    expect(screen.getByText('Set up the selected provider via Tools → Add, then return here.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Gemini Image Tools to Agent draft' })).not.toBeInTheDocument();
    expect(fields().tools).toEqual([]);
  });

  it('does not permit selecting an unavailable provider as though it were configured', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: /^Flux/ }));
    expect(screen.getByText(/not made this Tool available/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Flux to Agent draft' })).not.toBeInTheDocument();
    expect(fields().tools).toEqual([]);
  });

  it('copies an edited image request only on user action', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText }, configurable: true,
    });
    render(<Harness />);
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('2. Describe your image'), { target: { value: 'A snowy mountainside under starlight' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Image aspect ratio' }), { target: { value: 'landscape' } });
    fireEvent.click(screen.getByRole('button', { name: 'Copy image request' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('1536x1024')));
    expect(writeText.mock.calls[0][0]).toContain('A snowy mountainside under starlight');
    expect(screen.getByRole('button', { name: 'Copied image request' })).toBeInTheDocument();
  });

  it('disables copying an empty creative prompt and never claims media was rendered', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('2. Describe your image'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Copy image request' })).toBeDisabled();
    expect(screen.getByText(/the request cannot render/)).toBeInTheDocument();
  });
});
