import { AgentCapabilities, Constants, LocalStorageKeys, Tools } from 'librechat-data-provider';
import type { TEphemeralAgent } from 'librechat-data-provider';
import { setTimestamp } from '~/utils/timestamps';

/**
 * Recoil alone is not durable: on reload, BadgeRowProvider rehydrates each
 * tool toggle from LAST_*_<conversationId> in localStorage. Copy the user's
 * actual current New Chat tool settings to the prepared conversation *before*
 * navigating there. This preserves explicit OFF as well as ON; selecting a KB
 * by itself never enables File Search.
 *
 * No remote tool credentials, files or KB identifiers are stored here.
 */
export function persistPreparedChatTools(
  preparedId: string,
  sourceAgent: TEphemeralAgent | null | undefined,
): void {
  if (!preparedId || preparedId === Constants.NEW_CONVO || !sourceAgent) {
    return;
  }

  const entries = [
    [Tools.file_search, LocalStorageKeys.LAST_FILE_SEARCH_TOGGLE_],
    [Tools.web_search, LocalStorageKeys.LAST_WEB_SEARCH_TOGGLE_],
    [Tools.execute_code, LocalStorageKeys.LAST_CODE_TOGGLE_],
    [AgentCapabilities.artifacts, LocalStorageKeys.LAST_ARTIFACTS_TOGGLE_],
    [AgentCapabilities.skills, LocalStorageKeys.LAST_SKILLS_TOGGLE_],
    [Tools.memory, LocalStorageKeys.LAST_MEMORY_TOGGLE_],
  ] as const;

  for (const [tool, prefix] of entries) {
    const value = sourceAgent[tool];
    if (typeof value !== 'boolean' && typeof value !== 'string') {
      continue;
    }
    const key = `${prefix}${preparedId}`;
    localStorage.setItem(key, JSON.stringify(value));
    setTimestamp(key);
  }

  // MCP selection is also conversation-scoped, but do not persist credentials
  // or implicit permissions. A list merely preserves explicit UI choice.
  if (Array.isArray(sourceAgent.mcp)) {
    const key = `${LocalStorageKeys.LAST_MCP_}${preparedId}`;
    localStorage.setItem(key, JSON.stringify(sourceAgent.mcp));
    setTimestamp(key);
  }
}
