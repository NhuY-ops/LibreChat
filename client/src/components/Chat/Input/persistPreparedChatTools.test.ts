import { LocalStorageKeys, Tools } from 'librechat-data-provider';
import type { TEphemeralAgent } from 'librechat-data-provider';
import { getTimestampedValue } from '~/utils/timestamps';
import { persistPreparedChatTools } from './persistPreparedChatTools';

describe('MINE V4.3 prepared chat tool persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps File Search ON after a reload-style timestamped storage read', () => {
    persistPreparedChatTools('prepared-1', {
      [Tools.file_search]: true,
      [Tools.web_search]: false,
    } as TEphemeralAgent);
    expect(getTimestampedValue(`${LocalStorageKeys.LAST_FILE_SEARCH_TOGGLE_}prepared-1`))
      .toBe('true');
    expect(getTimestampedValue(`${LocalStorageKeys.LAST_WEB_SEARCH_TOGGLE_}prepared-1`))
      .toBe('false');
    expect(localStorage.getItem(`${LocalStorageKeys.LAST_FILE_SEARCH_TOGGLE_}prepared-1_TIMESTAMP`))
      .toMatch(/^\d+$/);
  });

  it('never implicitly enables File Search just because a KB was selected', () => {
    persistPreparedChatTools('prepared-off', {
      [Tools.file_search]: false,
    } as TEphemeralAgent);
    expect(getTimestampedValue(`${LocalStorageKeys.LAST_FILE_SEARCH_TOGGLE_}prepared-off`))
      .toBe('false');
  });

  it('never copies settings into another conversation or from absent state', () => {
    const prior = `${LocalStorageKeys.LAST_FILE_SEARCH_TOGGLE_}other-chat`;
    localStorage.setItem(prior, 'false');
    persistPreparedChatTools('prepared-1', { [Tools.file_search]: true } as TEphemeralAgent);
    persistPreparedChatTools('prepared-2', null);
    expect(localStorage.getItem(prior)).toBe('false');
    expect(localStorage.getItem(`${LocalStorageKeys.LAST_FILE_SEARCH_TOGGLE_}prepared-2`))
      .toBeNull();
  });

  it('does not invent absent tool choices, but retains an explicit MCP list', () => {
    persistPreparedChatTools('prepared-mcp', {
      [Tools.file_search]: true,
      mcp: ['test-server'],
    } as TEphemeralAgent);
    expect(localStorage.getItem(`${LocalStorageKeys.LAST_CODE_TOGGLE_}prepared-mcp`))
      .toBeNull();
    expect(getTimestampedValue(`${LocalStorageKeys.LAST_MCP_}prepared-mcp`))
      .toBe('["test-server"]');
  });
});
