const mockAgentFind = jest.fn();
const mockSourceAgentsFind = jest.fn();
const mockKbFind = jest.fn();
const mockFileFind = jest.fn();
const mockTenant = jest.fn();
const mockChatSelectionFindOne = jest.fn();
jest.mock('@librechat/data-schemas', () => ({
  getTenantId: () => mockTenant(),
  SYSTEM_TENANT_ID: '__SYSTEM__',
  logger: { error: jest.fn() },
}));
jest.mock('~/db/models', () => ({
  Agent: {
    findOne: (...a) => ({ select: () => ({ lean: () => mockAgentFind(...a) }) }),
    find: (...a) => ({ select: () => ({ lean: () => mockSourceAgentsFind(...a) }) }),
  },
  File: { find: (...a) => ({ select: () => ({ lean: () => mockFileFind(...a) }) }) },
}));
jest.mock('./model', () => ({
  find: (...a) => ({ select: () => ({ lean: () => mockKbFind(...a) }) }),
}));
jest.mock('./chatSelection', () => ({
  findOne: (...a) => ({ lean: () => mockChatSelectionFindOne(...a) }),
}));
const { grantedFileIds, resolveAgentKnowledgeFiles } = require('./agentAccess');

beforeEach(() => {
  jest.clearAllMocks();
  mockTenant.mockReturnValue('team-a');
  mockAgentFind.mockResolvedValue({ _id: 'owned' });
  mockSourceAgentsFind.mockResolvedValue([]);
  mockKbFind.mockResolvedValue([]);
  mockFileFind.mockResolvedValue([]);
  mockChatSelectionFindOne.mockResolvedValue(null);
});
describe('Agent KB retrieval (fail closed)', () => {
  const params = { agentId: 'agent_test', userId: 'user-a', tenantId: 'team-a' };
  it('keeps no-access as default', () => {
    expect(grantedFileIds([{ file_ids: ['secret'], agent_access: [] }], params.agentId)).toEqual([]);
  });
  it('matches ANY permitted tag and not untagged files', () => {
    expect(grantedFileIds([{
      file_ids: ['a', 'b', 'c'],
      agent_access: [{ agent_id: params.agentId, tags: ['immunology', 'research'] }],
      file_tags: [
        { file_id: 'a', tags: ['immunology'] },
        { file_id: 'b', tags: ['history'] },
        { file_id: 'c', tags: ['research'] },
      ],
    }], params.agentId)).toEqual(['a', 'c']);
  });
  it('allows all linked files when no tags selected and deduplicates them', () => {
    expect(grantedFileIds([
      { file_ids: ['a', 'b'], agent_access: [{ agent_id: params.agentId, tags: [] }] },
      { file_ids: ['b', 'c'], agent_access: [{ agent_id: params.agentId, tags: [] }] },
    ], params.agentId)).toEqual(['a', 'b', 'c']);
  });
  it('narrows permitted files to selected chat libraries and tags', () => {
    const libraries = [
      {
        _id: 'library-1', file_ids: ['a', 'b'],
        agent_access: [{ agent_id: 'agent_test', tags: [] }],
        file_tags: [{ file_id: 'a', tags: ['immunology'] }, { file_id: 'b', tags: ['history'] }],
      },
      {
        _id: 'library-2', file_ids: ['c'],
        agent_access: [{ agent_id: 'agent_test', tags: [] }],
      },
    ];
    expect(grantedFileIds(libraries, 'agent_test', {
      libraries: [{ kb_id: 'library-1', tags: ['immunology'] }],
    })).toEqual(['a']);
    expect(grantedFileIds(libraries, 'agent_test', { libraries: [] })).toEqual([]);
    expect(grantedFileIds(libraries, 'agent_test', null)).toEqual(['a', 'b', 'c']);
  });

  it('never expands restrictive Agent tags via a broader chat filter', () => {
    expect(grantedFileIds([{
      _id: 'library-1', file_ids: ['immune', 'history'],
      agent_access: [{ agent_id: 'agent_test', tags: ['immunology'] }],
      file_tags: [
        { file_id: 'immune', tags: ['immunology', 'clinical'] },
        { file_id: 'history', tags: ['clinical'] },
      ],
    }], 'agent_test', { libraries: [{ kb_id: 'library-1', tags: ['clinical'] }] }))
      .toEqual(['immune']);
  });

  it('reads chat-specific disabled selection on each authorization request', async () => {
    mockKbFind.mockResolvedValueOnce([
      { _id: 'library-1', file_ids: ['a'],
        agent_access: [{ agent_id: 'agent_test', tags: [] }] },
    ]);
    mockChatSelectionFindOne.mockResolvedValueOnce({ libraries: [] });
    expect(await resolveAgentKnowledgeFiles({
      agentId: 'agent_test', userId: 'user-a', tenantId: 'team-a',
      conversationId: 'chat-123',
    })).toEqual([]);
    expect(mockChatSelectionFindOne).toHaveBeenCalledWith({
      owner: 'user-a', tenantId: 'team-a', conversationId: 'chat-123', agentId: 'agent_test',
    });
    expect(mockFileFind).not.toHaveBeenCalled();
  });

  it('rejects shared Agents rather than inheriting grants', async () => {
    mockAgentFind.mockResolvedValueOnce(null);
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([]);
    expect(mockAgentFind).toHaveBeenCalledWith({
      id: params.agentId, author: params.userId, tenantId: params.tenantId,
    });
    expect(mockKbFind).not.toHaveBeenCalled();
  });
  it('rechecks mockTenant, ownership, embedding and expiry for each file', async () => {
    mockKbFind.mockResolvedValueOnce([
      { file_ids: ['a', 'expired'], agent_access: [{ agent_id: params.agentId, tags: [] }] },
    ]);
    mockFileFind.mockResolvedValueOnce([{ file_id: 'a', filename: 'notes.pdf', user: params.userId }]);
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([
      { file_id: 'a', filename: 'notes.pdf', user: params.userId, kbManaged: true },
    ]);
    expect(mockKbFind).toHaveBeenCalledWith({
      owner: params.userId, tenantId: params.tenantId, 'agent_access.agent_id': params.agentId,
    });
    expect(mockFileFind).toHaveBeenCalledWith(expect.objectContaining({
      user: params.userId, tenantId: params.tenantId, embedded: true,
      file_id: { $in: ['a', 'expired'] }, $or: expect.any(Array),
    }));
  });
  it('resolves a legacy Agent file only from a same-owner, same-tenant source', async () => {
    mockKbFind.mockResolvedValueOnce([
      { file_ids: ['file-agent'], agent_access: [{ agent_id: params.agentId, tags: [] }] },
    ]);
    mockFileFind.mockResolvedValueOnce([{
      file_id: 'file-agent', filename: 'immune.txt', user: params.userId,
      context: 'agents', metadata: { embeddedEntities: ['agent_original'] },
    }]);
    mockSourceAgentsFind.mockResolvedValueOnce([{ id: 'agent_original' }]);
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([{
      file_id: 'file-agent', filename: 'immune.txt', user: params.userId,
      kbManaged: true, ragEntityId: 'agent_original',
    }]);
    expect(mockSourceAgentsFind).toHaveBeenCalledWith({
      id: { $in: ['agent_original'] },
      author: params.userId, tenantId: params.tenantId,
    });
  });

  it('does not fall back to user namespace for a deleted or foreign Agent source', async () => {
    mockKbFind.mockResolvedValueOnce([
      { file_ids: ['file-agent'], agent_access: [{ agent_id: params.agentId, tags: [] }] },
    ]);
    mockFileFind.mockResolvedValueOnce([{
      file_id: 'file-agent', filename: 'immune.txt', user: params.userId,
      context: 'agents', metadata: { embeddedEntities: ['agent_not_owned'] },
    }]);
    mockSourceAgentsFind.mockResolvedValueOnce([]);
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([]);
  });

  it('keeps a regular user-indexed KB attachment in user RAG scope', async () => {
    mockKbFind.mockResolvedValueOnce([
      { file_ids: ['file-user'], agent_access: [{ agent_id: params.agentId, tags: [] }] },
    ]);
    mockFileFind.mockResolvedValueOnce([{
      file_id: 'file-user', filename: 'notes.txt', user: params.userId,
      context: 'message_attachment',
    }]);
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([{
      file_id: 'file-user', filename: 'notes.txt', user: params.userId, kbManaged: true,
    }]);
    expect(mockSourceAgentsFind).not.toHaveBeenCalled();
  });

  it('denies revoked grant', async () => {
    mockKbFind.mockResolvedValueOnce([{ file_ids: ['a'], agent_access: [] }]);
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([]);
    expect(mockFileFind).not.toHaveBeenCalled();
  });
  it('denies missing mockTenant context in strict mode', async () => {
    const before = process.env.TENANT_ISOLATION_STRICT;
    process.env.TENANT_ISOLATION_STRICT = 'true';
    mockTenant.mockReturnValue(undefined);
    try {
      expect(await resolveAgentKnowledgeFiles({ ...params, tenantId: undefined })).toEqual([]);
      expect(mockAgentFind).not.toHaveBeenCalled();
    } finally {
      if (before == null) delete process.env.TENANT_ISOLATION_STRICT;
      else process.env.TENANT_ISOLATION_STRICT = before;
    }
  });
  it('denies mismatched authenticated and request mockTenant contexts', async () => {
    mockTenant.mockReturnValue('team-b');
    expect(await resolveAgentKnowledgeFiles({
      agentId: 'agent_test', userId: 'user-a', tenantId: 'team-a',
    })).toEqual([]);
    expect(mockAgentFind).not.toHaveBeenCalled();
  });
  it('denies DB failures', async () => {
    mockKbFind.mockRejectedValueOnce(new Error('network'));
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([]);
  });
});
