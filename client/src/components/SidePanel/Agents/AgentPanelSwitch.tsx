import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { useRecoilValue } from 'recoil';
import { AgentPanelProvider, useAgentPanelContext } from '~/Providers/AgentPanelContext';
import { Panel, isEphemeralAgent } from '~/common';
import VersionPanel from './Version/VersionPanel';
import AgentPanel from './AgentPanel';
import { mineTemplateBuilderSessionAtom } from './mineTemplateHandoff';
import store from '~/store';

export default function AgentPanelSwitch() {
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const agentId = conversation?.agent_id ?? null;
  return (
    <AgentPanelProvider
      observeToolAuthorization={conversation != null && !isEphemeralAgent(agentId)}
    >
      <AgentPanelSwitchWithContext agentId={agentId} />
    </AgentPanelProvider>
  );
}

function AgentPanelSwitchWithContext({ agentId }: { agentId?: string | null }) {
  const { activePanel, setCurrentAgentId } = useAgentPanelContext();
  const templateBuilderSession = useAtomValue(mineTemplateBuilderSessionAtom);
  const suspendedConversationAgentRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // The chat on the right can still show a Research Agent even though the
    // user is building a separate new AI Image Creator on the left. Never let
    // its agent_id hijack the form while a Marketplace draft is active.
    if (templateBuilderSession) {
      suspendedConversationAgentRef.current = agentId ?? null;
      setCurrentAgentId(undefined);
      return;
    }
    // On successful Agent creation the Builder session is released while the
    // old Chat still points to Research. Ignore that stale chat pick ONCE so
    // it cannot immediately replace the newly saved Image Creator.
    if (suspendedConversationAgentRef.current !== undefined) {
      const suspended = suspendedConversationAgentRef.current;
      suspendedConversationAgentRef.current = undefined;
      if (suspended === (agentId ?? null)) {
        return;
      }
    }
    const agent_id = agentId ?? '';
    if (!isEphemeralAgent(agent_id)) {
      setCurrentAgentId(agent_id);
    }
  }, [setCurrentAgentId, agentId, templateBuilderSession]);

  if (activePanel === Panel.version) {
    return <VersionPanel />;
  }
  return <AgentPanel />;
}
