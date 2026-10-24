const express = require('express');
const request = require('supertest');

const mockGetTenantId = jest.fn();
const mockFind = jest.fn();
const mockCount = jest.fn();
const mockCreate = jest.fn();
const mockFindOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();
const mockFindOneAndDelete = jest.fn();
const mockFileFindOne = jest.fn();
const mockFileFind = jest.fn();

jest.mock('@librechat/data-schemas', () => ({
  getTenantId: () => mockGetTenantId(),
  SYSTEM_TENANT_ID: '__SYSTEM__',
  logger: { error: jest.fn() },
}));
jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => next(),
}));
jest.mock('~/db/models', () => ({
  File: {
    findOne: (...args) => ({
      select: () => ({ lean: () => mockFileFindOne(...args) }),
    }),
    find: (...args) => ({
      select: () => ({ lean: () => mockFileFind(...args) }),
    }),
  },
}));
jest.mock('~/server/services/KnowledgeBase/model', () => ({
  find: (...args) => ({
    sort: () => ({ limit: () => ({ lean: () => mockFind(...args) }) }),
  }),
  countDocuments: (...args) => mockCount(...args),
  create: (...args) => mockCreate(...args),
  findOne: (...args) => ({ lean: () => mockFindOne(...args) }),
  findOneAndUpdate: (...args) => ({ lean: () => mockFindOneAndUpdate(...args) }),
  findOneAndDelete: (...args) => ({ lean: () => mockFindOneAndDelete(...args) }),
}));

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: req.get('x-user') || 'owner-a' };
  next();
});
app.use('/api/knowledge', require('./knowledge'));

const KB_ID = '507f1f77bcf86cd799439011';
const FILE_ID = 'owner-owned-file-1';
const kb = { _id: KB_ID, name: 'Research', description: '', file_ids: [] };
const withUser = (name) => request(app).get(name).set('x-user', 'owner-a');

beforeEach(() => {
  jest.clearAllMocks();
  mockGetTenantId.mockReturnValue('team-one');
  mockFind.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);
  mockCreate.mockResolvedValue(kb);
  mockFindOne.mockResolvedValue(kb);
  mockFindOneAndUpdate.mockResolvedValue({ ...kb, file_ids: [FILE_ID] });
  mockFindOneAndDelete.mockResolvedValue(kb);
  mockFileFindOne.mockResolvedValue({ _id: 'file-mongo-id' });
  mockFileFind.mockResolvedValue([]);
});

describe('MINE Knowledge Base management API', () => {
  it('lists only collections scoped to the authenticated owner and tenant', async () => {
    const response = await withUser('/api/knowledge');
    expect(response.status).toBe(200);
    expect(mockFind).toHaveBeenCalledWith({ owner: 'owner-a', tenantId: 'team-one' });
  });

  it('requires a name and never accepts caller-supplied owner or tenant', async () => {
    expect((await request(app).post('/api/knowledge').send({ name: ' ' })).status).toBe(400);
    const response = await request(app).post('/api/knowledge').send({
      name: 'My Library',
      owner: 'someone-else',
      tenantId: 'evil-tenant',
      file_ids: ['not-owned'],
    });
    expect(response.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'My Library',
      description: '',
      owner: 'owner-a',
      tenantId: 'team-one',
    });
  });

  it('checks file ownership + tenant + indexing before adding file reference', async () => {
    mockFileFindOne.mockResolvedValueOnce(null);
    const response = await request(app).post('/api/knowledge/' + KB_ID + '/files')
      .send({ file_id: FILE_ID });
    expect(response.status).toBe(404);
    expect(mockFileFindOne).toHaveBeenCalledWith(expect.objectContaining({
      user: 'owner-a', tenantId: 'team-one', file_id: FILE_ID, embedded: true,
    }));
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('adds a valid owned file reference without deleting or rewriting its source', async () => {
    const response = await request(app).post('/api/knowledge/' + KB_ID + '/files')
      .send({ file_id: FILE_ID });
    expect(response.status).toBe(200);
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'owner-a', tenantId: 'team-one', _id: KB_ID }),
      { $addToSet: { file_ids: FILE_ID } },
      expect.objectContaining({ new: true }),
    );
  });

  it('rejects cross-account library IDs even when syntactically valid', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const response = await request(app).post('/api/knowledge/' + KB_ID + '/files')
      .send({ file_id: FILE_ID });
    expect(response.status).toBe(404);
    expect(mockFileFindOne).not.toHaveBeenCalled();
  });

  it('lists only metadata that File ownership and tenant checks authorize', async () => {
    mockFindOne.mockResolvedValueOnce({ ...kb, file_ids: [FILE_ID] });
    mockFileFind.mockResolvedValueOnce([
      { file_id: FILE_ID, filename: 'notes.pdf', type: 'application/pdf', bytes: 12 },
    ]);
    const response = await withUser('/api/knowledge/' + KB_ID + '/files');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { file_id: FILE_ID, filename: 'notes.pdf', type: 'application/pdf', bytes: 12 },
    ]);
    expect(mockFileFind).toHaveBeenCalledWith(expect.objectContaining({
      user: 'owner-a', tenantId: 'team-one', embedded: true,
      file_id: { $in: [FILE_ID] },
    }));
  });

  it('fails closed without tenant context in strict deployments', async () => {
    const prior = process.env.TENANT_ISOLATION_STRICT;
    process.env.TENANT_ISOLATION_STRICT = 'true';
    mockGetTenantId.mockReturnValue(undefined);
    try {
      const response = await withUser('/api/knowledge');
      expect(response.status).toBe(403);
      expect(mockFind).not.toHaveBeenCalled();
    } finally {
      if (prior == null) delete process.env.TENANT_ISOLATION_STRICT;
      else process.env.TENANT_ISOLATION_STRICT = prior;
    }
  });

  it('removes association and leaves the original RAG file intact', async () => {
    const response = await request(app).delete('/api/knowledge/' + KB_ID + '/files/' + FILE_ID);
    expect(response.status).toBe(200);
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { owner: 'owner-a', tenantId: 'team-one', _id: KB_ID },
      { $pull: { file_ids: FILE_ID } },
      { new: true },
    );
  });
});
