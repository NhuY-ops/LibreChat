import React from 'react';
import { act } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { mineTemplateBuilderSessionAtom } from './mineTemplateHandoff';
import { RecoilRoot } from 'recoil';
import { render } from '@testing-library/react';
import { EModelEndpoint } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import store from '~/store';

const mockObserveToolAuthorization = jest.fn();
const mockSetCurrentAgentId = jest.fn();

jest.mock('~/Providers/AgentPanelContext', () => ({
  AgentPanelProvider: ({
    children,
    observeToolAuthorization,
  }: {
    children: React.ReactNode;
    observeToolAuthorization: boolean;
  }) => {
    mockObserveToolAuthorization(observeToolAuthorization);
    return children;
  },
  useAgentPanelContext: () => ({
    activePanel: 'builder',
    setCurrentAgentId: mockSetCurrentAgentId,
  }),
}));
jest.mock('./AgentPanel', () => () => null);
jest.mock('./Version/VersionPanel', () => () => null);

import AgentPanelSwitch from './AgentPanelSwitch';

function renderWithConversation(conversation?: TConversation) {
  return render(
    <RecoilRoot
      initializeState={({ set }) => {
        if (conversation != null) {
          set(store.conversationByIndex(0), conversation);
        }
      }}
    >
      <AgentPanelSwitch />
    </RecoilRoot>,
  );
}

describe('AgentPanelSwitch authorization observers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getDefaultStore().set(mineTemplateBuilderSessionAtom, null);
  });

  it('holds observers until the conversation is hydrated', () => {
    renderWithConversation();
    expect(mockObserveToolAuthorization).toHaveBeenLastCalledWith(false);
  });

  it('enables observers for a hydrated persistent agent', () => {
    renderWithConversation({
      conversationId: 'new',
      endpoint: EModelEndpoint.agents,
      agent_id: 'agent_1',
    } as TConversation);
    expect(mockObserveToolAuthorization).toHaveBeenLastCalledWith(true);
  });

  it('keeps a Marketplace Image Creator draft separate from the Research chat Agent', () => {
    getDefaultStore().set(mineTemplateBuilderSessionAtom, 'image-creator');
    renderWithConversation({
      conversationId: 'new',
      endpoint: EModelEndpoint.agents,
      agent_id: 'saved_research_agent',
    } as TConversation);
    expect(mockSetCurrentAgentId).toHaveBeenCalledWith(undefined);
    expect(mockSetCurrentAgentId).not.toHaveBeenCalledWith('saved_research_agent');
  });

  it('does not immediately restore the stale Research chat after saving the new Agent', () => {
    getDefaultStore().set(mineTemplateBuilderSessionAtom, 'image-creator');
    renderWithConversation({
      conversationId: 'new',
      endpoint: EModelEndpoint.agents,
      agent_id: 'saved_research_agent',
    } as TConversation);
    mockSetCurrentAgentId.mockClear();
    act(() => {
      getDefaultStore().set(mineTemplateBuilderSessionAtom, null);
    });
    expect(mockSetCurrentAgentId).not.toHaveBeenCalledWith('saved_research_agent');
  });

  it('keeps observers disabled for a hydrated ephemeral agent', () => {
    renderWithConversation({
      conversationId: 'new',
      endpoint: EModelEndpoint.agents,
      agent_id: 'ephemeral',
    } as TConversation);
    expect(mockObserveToolAuthorization).toHaveBeenLastCalledWith(false);
  });
});
