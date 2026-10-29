import React from 'react';
import { RecoilRoot, useRecoilValue } from 'recoil';
import { renderHook, act, waitFor } from '@testing-library/react';

import { ephemeralAgentByConvoId, useApplyNewAgentTemplate } from '../agents';

jest.mock('~/utils', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <RecoilRoot>{children}</RecoilRoot>
);

const useAgentTemplateHarness = (conversationId: string) => {
  const applyTemplate = useApplyNewAgentTemplate();
  const ephemeralAgent = useRecoilValue(ephemeralAgentByConvoId(conversationId));
  return { applyTemplate, ephemeralAgent };
};

describe('MINE KB V4.3 prepare tool-state handoff', () => {
  it('preserves File Search and other New Chat toggles in the prepared conversation', async () => {
    const sourceId = 'new';
    const preparedId = 'prepared-chat-123';
    const source = { file_search: true, web_search: false, execute_code: true };
    const PreparedWrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot initializeState={({ set }) => {
        set(ephemeralAgentByConvoId(sourceId), source);
      }}>
        {children}
      </RecoilRoot>
    );
    const { result } = renderHook(() => useAgentTemplateHarness(preparedId), {
      wrapper: PreparedWrapper,
    });
    await act(async () => {
      await result.current.applyTemplate(preparedId, sourceId);
    });
    await waitFor(() => {
      expect(result.current.ephemeralAgent).toEqual(source);
      expect(result.current.ephemeralAgent?.file_search).toBe(true);
    });
  });

  it('does not enable File Search when it was disabled in New Chat', async () => {
    const sourceId = 'new';
    const preparedId = 'prepared-chat-off';
    const PreparedWrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot initializeState={({ set }) => {
        set(ephemeralAgentByConvoId(sourceId), { file_search: false });
      }}>
        {children}
      </RecoilRoot>
    );
    const { result } = renderHook(() => useAgentTemplateHarness(preparedId), {
      wrapper: PreparedWrapper,
    });
    await act(async () => {
      await result.current.applyTemplate(preparedId, sourceId);
    });
    await waitFor(() => {
      expect(result.current.ephemeralAgent?.file_search).toBe(false);
    });
  });
});

describe('useApplyNewAgentTemplate', () => {
  it('applies an explicit ephemeral agent when optimistic hydration makes source and target match', async () => {
    const conversationId = 'convo-123';
    const agent = {
      mcp: ['chrome-devtools'],
      skills: true,
      artifacts: 'default',
      web_search: true,
      file_search: true,
      execute_code: true,
    };
    const { result } = renderHook(() => useAgentTemplateHarness(conversationId), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.applyTemplate(conversationId, conversationId, agent);
    });

    await waitFor(() => {
      expect(result.current.ephemeralAgent).toEqual(agent);
    });
  });
});
