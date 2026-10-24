const agentFind = jest.fn();
const kbFind = jest.fn();
const fileFind = jest.fn();
const tenant = jest.fn();
jest.mock('@librechat/data-schemas', () => ({
  getTenantId: () => tenant(),
  SYSTEM_TENANT_ID: '__SYSTEM__',
  logger: { error: jest.fn() },
}));
jest.mock('~/db/models', () => ({
  Agent: { findOne: (...a) => ({ select: () => ({ lean: () => agentFind(...a) }) }) },
  File: { find: (...a) => ({ select: () => ({ lean: () => fileFind(...a) }) }) },
}));
jest.mock('./model', () => ({
  find: (...a) => ({ select: () => ({ lean: () => kbFind(...a) }) }),
}));
const { grantedFileIds, resolveAgentKnowledgeFiles } = require('./agentAccess');

beforeEach(() => {
  jest.clearAllMocks();
  tenant.mockReturnValue('team-a');
  agentFind.mockResolvedValue({ _id: 'owned' });
  kbFind.mockResolvedValue([]);
  fileFind.mockResolvedValue([]);
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
  it('rejects shared Agents rather than inheriting grants', async () => {
    agentFind.mockResolvedValueOnce(null);
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([]);
    expect(agentFind).toHaveBeenCalledWith({
      id: params.agentId, author: params.userId, tenantId: params.tenantId,
    });
    expect(kbFind).not.toHaveBeenCalled();
  });
  it('rechecks tenant, ownership, embedding and expiry for each file', async () => {
    kbFind.mockResolvedValueOnce([
      { file_ids: ['a', 'expired'], agent_access: [{ agent_id: params.agentId, tags: [] }] },
    ]);
    fileFind.mockResolvedValueOnce([{ file_id: 'a', filename: 'notes.pdf', user: params.userId }]);
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([
      { file_id: 'a', filename: 'notes.pdf', user: params.userId, kbManaged: true },
    ]);
    expect(kbFind).toHaveBeenCalledWith({
      owner: params.userId, tenantId: params.tenantId, 'agent_access.agent_id': params.agentId,
    });
    expect(fileFind).toHaveBeenCalledWith(expect.objectContaining({
      user: params.userId, tenantId: params.tenantId, embedded: true,
      file_id: { $in: ['a', 'expired'] }, $or: expect.any(Array),
    }));
  });
  it('denies revoked grant', async () => {
    kbFind.mockResolvedValueOnce([{ file_ids: ['a'], agent_access: [] }]);
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([]);
    expect(fileFind).not.toHaveBeenCalled();
  });
  it('denies missing tenant context in strict mode', async () => {
    const before = process.env.TENANT_ISOLATION_STRICT;
    process.env.TENANT_ISOLATION_STRICT = 'true';
    tenant.mockReturnValue(undefined);
    try {
      expect(await resolveAgentKnowledgeFiles({ ...params, tenantId: undefined })).toEqual([]);
      expect(agentFind).not.toHaveBeenCalled();
    } finally {
      if (before == null) delete process.env.TENANT_ISOLATION_STRICT;
      else process.env.TENANT_ISOLATION_STRICT = before;
    }
  });
  it('denies DB failures', async () => {
    kbFind.mockRejectedValueOnce(new Error('network'));
    expect(await resolveAgentKnowledgeFiles(params)).toEqual([]);
  });
});
