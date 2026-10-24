const mockTenant = jest.fn();
const mockConversationFind = jest.fn();
const mockSelectionFind = jest.fn();
const mockKbFind = jest.fn();
const mockFileFind = jest.fn();
const mockAgentFind = jest.fn();

jest.mock('@librechat/data-schemas', () => ({
  getTenantId: () => mockTenant(),
  SYSTEM_TENANT_ID: '__SYSTEM__',
  logger: { error: jest.fn() },
}));
jest.mock('~/db/models', () => ({
  Conversation: {
    findOne: (...a) => ({ select: () => ({ lean: () => mockConversationFind(...a) }) }),
  },
  File: {
    find: (...a) => ({ select: () => ({ lean: () => mockFileFind(...a) }) }),
  },
  Agent: {
    find: (...a) => ({ select: () => ({ lean: () => mockAgentFind(...a) }) }),
  },
}));
jest.mock('./model', () => ({
  find: (...a) => ({ select: () => ({ lean: () => mockKbFind(...a) }) }),
}));
jest.mock('./chatSelection', () => ({
  findOne: (...a) => ({ lean: () => mockSelectionFind(...a) }),
}));

const { REGULAR_CHAT_SCOPE, resolveChatKnowledgeFiles } = require('./chatAccess');

const scope = { userId: 'owner-a', tenantId: 'team-a', conversationId: 'chat-123' };
const linked = {
  _id: '507f1f77bcf86cd799439011',
  file_ids: ['immune', 'history'],
  file_tags: [
    { file_id: 'immune', tags: ['clinical'] },
    { file_id: 'history', tags: ['history'] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTenant.mockReturnValue('team-a');
  mockConversationFind.mockResolvedValue({ agent_id: null });
  mockSelectionFind.mockResolvedValue(null);
  mockKbFind.mockResolvedValue([]);
  mockFileFind.mockResolvedValue([]);
  mockAgentFind.mockResolvedValue([]);
});

describe('regular chat KB access (V4.2, fail closed)', () => {
  it('does not read any KB without a saved explicit chat selection', async () => {
    expect(await resolveChatKnowledgeFiles(scope)).toEqual([]);
    expect(mockSelectionFind).toHaveBeenCalledWith({
      owner: 'owner-a', tenantId: 'team-a', conversationId: 'chat-123',
      agentId: REGULAR_CHAT_SCOPE,
    });
    expect(mockKbFind).not.toHaveBeenCalled();
  });
  it('does not read KBs from an Agent conversation', async () => {
    mockConversationFind.mockResolvedValueOnce({ agent_id: 'agent_owned' });
    expect(await resolveChatKnowledgeFiles(scope)).toEqual([]);
    expect(mockSelectionFind).not.toHaveBeenCalled();
  });
  it('rejects nonexistent, foreign, temporary, or mismatched-tenant chat', async () => {
    mockConversationFind.mockResolvedValueOnce(null);
    expect(await resolveChatKnowledgeFiles(scope)).toEqual([]);
    expect(mockConversationFind).toHaveBeenCalledWith({
      conversationId: 'chat-123', user: 'owner-a', tenantId: 'team-a',
      isTemporary: { $ne: true },
    });
    expect(await resolveChatKnowledgeFiles({ ...scope, tenantId: 'other' })).toEqual([]);
    expect(await resolveChatKnowledgeFiles({ ...scope, conversationId: 'new' })).toEqual([]);
    expect(mockSelectionFind).not.toHaveBeenCalled();
  });
  it('reads only owner-approved KB files matching selected tags and valid embedded files', async () => {
    mockSelectionFind.mockResolvedValueOnce({
      libraries: [{ kb_id: linked._id, tags: ['clinical'] }],
    });
    mockKbFind.mockResolvedValueOnce([linked]);
    mockFileFind.mockResolvedValueOnce([
      { file_id: 'immune', filename: 'immune.txt', user: 'owner-a' },
    ]);
    expect(await resolveChatKnowledgeFiles(scope)).toEqual([
      { file_id: 'immune', filename: 'immune.txt', user: 'owner-a', kbManaged: true },
    ]);
    expect(mockKbFind).toHaveBeenCalledWith({
      owner: 'owner-a', tenantId: 'team-a', _id: { $in: [linked._id] },
    });
    expect(mockFileFind).toHaveBeenCalledWith(expect.objectContaining({
      user: 'owner-a', tenantId: 'team-a', embedded: true,
      file_id: { $in: ['immune'] }, $or: expect.any(Array),
    }));
  });
  it('preserves verified original Agent RAG namespace and rejects foreign source', async () => {
    mockSelectionFind.mockResolvedValue({
      libraries: [{ kb_id: linked._id, tags: [] }],
    });
    mockKbFind.mockResolvedValue([linked]);
    mockFileFind.mockResolvedValue([{
      file_id: 'immune', filename: 'immune.txt', user: 'owner-a',
      context: 'agents', metadata: { embeddedEntities: ['agent_original'] },
    }]);
    expect(await resolveChatKnowledgeFiles(scope)).toEqual([]);
    mockAgentFind.mockResolvedValueOnce([{ id: 'agent_original' }]);
    expect(await resolveChatKnowledgeFiles(scope)).toEqual([{
      file_id: 'immune', filename: 'immune.txt', user: 'owner-a',
      kbManaged: true, ragEntityId: 'agent_original',
    }]);
    expect(mockAgentFind).toHaveBeenLastCalledWith({
      id: { $in: ['agent_original'] }, author: 'owner-a', tenantId: 'team-a',
    });
  });
  it('does not read after selection is explicitly disabled', async () => {
    mockSelectionFind.mockResolvedValueOnce({ libraries: [] });
    expect(await resolveChatKnowledgeFiles(scope)).toEqual([]);
    expect(mockFileFind).not.toHaveBeenCalled();
  });
});
