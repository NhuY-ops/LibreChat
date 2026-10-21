import { useEffect } from 'react';
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

  useEffect(() => {
    // Agent Builder has its own pending, unsaved draft when a Marketplace
    // blueprint is being configured. ChatRoute may still show the previously
    // selected Research Analyst on the right: that must NEVER overwrite the
    // draft or auto-select Research in the left-side Agent editor.
    if (templateBuilderSession) {
      setCurrentAgentId(undefined);
      return;
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
