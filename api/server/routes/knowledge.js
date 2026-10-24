const express = require('express');
const { getTenantId, SYSTEM_TENANT_ID, logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const { File } = require('~/db/models');
const KnowledgeBase = require('~/server/services/KnowledgeBase/model');

const router = express.Router();
const MAX_LIBRARIES = 100;
const MAX_FILES = 250;
const ID_PATTERN = /^[a-f\d]{24}$/i;
const FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,150}$/;

router.use(requireJwtAuth);

function requestScope(req, res) {
  const owner = req.user?.id?.toString?.() ?? req.user?._id?.toString?.();
  const tenant = getTenantId();
  if (
    !owner ||
    tenant === SYSTEM_TENANT_ID ||
    (process.env.TENANT_ISOLATION_STRICT === 'true' && !tenant)
  ) {
    res.status(403).json({ error: 'Knowledge Base scope is unavailable.' });
    return null;
  }
  return { owner, tenantId: tenant ?? null };
}

function validName(input) {
  return typeof input === 'string' && input.trim().length > 0 && input.trim().length <= 100;
}
function validDescription(input) {
  return input === undefined || (typeof input === 'string' && input.trim().length <= 500);
}
function validId(input) {
  return typeof input === 'string' && ID_PATTERN.test(input);
}
function fileScope(scope, fileId) {
  return {
    file_id: fileId,
    user: scope.owner,
    tenantId: scope.tenantId,
    embedded: true,
    $or: [{ expiredAt: null }, { expiredAt: { $gt: new Date() } }],
  };
}
function serialize(item) {
  const doc = item.toObject ? item.toObject() : item;
  return {
    _id: String(doc._id),
    name: doc.name,
    description: doc.description ?? '',
    file_ids: doc.file_ids ?? [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}
function failed(res, error) {
  logger.error('[MINE Knowledge Base] request failed', error);
  res.status(500).json({ error: 'Knowledge Base operation failed.' });
}

router.get('/', async (req, res) => {
  const scope = requestScope(req, res);
  if (!scope) return;
  try {
    const libraries = await KnowledgeBase.find(scope).sort({ updatedAt: -1 }).limit(MAX_LIBRARIES).lean();
    res.json(libraries.map(serialize));
  } catch (error) {
    failed(res, error);
  }
});

router.post('/', async (req, res) => {
  const scope = requestScope(req, res);
  if (!scope) return;
  const { name, description } = req.body ?? {};
  if (!validName(name) || !validDescription(description)) {
    return res.status(400).json({ error: 'Name is required (max 100 characters); description max 500.' });
  }
  try {
    const count = await KnowledgeBase.countDocuments(scope);
    if (count >= MAX_LIBRARIES) {
      return res.status(409).json({ error: 'Knowledge Base limit reached.' });
    }
    const created = await KnowledgeBase.create({
      ...scope,
      name: name.trim(),
      description: description?.trim() ?? '',
    });
    return res.status(201).json(serialize(created));
  } catch (error) {
    return failed(res, error);
  }
});

router.get('/:id/files', async (req, res) => {
  const scope = requestScope(req, res);
  if (!scope) return;
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid Knowledge Base ID.' });
  try {
    const kb = await KnowledgeBase.findOne({ ...scope, _id: req.params.id }).lean();
    if (!kb) return res.status(404).json({ error: 'Knowledge Base not found.' });
    if (!kb.file_ids?.length) return res.json([]);
    // Never return metadata simply because its id was referenced: recheck owner,
    // tenant, embed state and expiration on every read.
    const files = await File.find({
      user: scope.owner,
      tenantId: scope.tenantId,
      file_id: { $in: kb.file_ids },
      embedded: true,
      $or: [{ expiredAt: null }, { expiredAt: { $gt: new Date() } }],
    }).select('file_id filename type bytes').lean();
    const byId = new Map(files.map((file) => [file.file_id, file]));
    return res.json(kb.file_ids.filter((id) => byId.has(id)).map((id) => {
      const file = byId.get(id);
      return { file_id: file.file_id, filename: file.filename, type: file.type, bytes: file.bytes };
    }));
  } catch (error) {
    return failed(res, error);
  }
});

router.post('/:id/files', async (req, res) => {
  const scope = requestScope(req, res);
  if (!scope) return;
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid Knowledge Base ID.' });
  const fileId = req.body?.file_id;
  if (typeof fileId !== 'string' || !FILE_ID_PATTERN.test(fileId)) {
    return res.status(400).json({ error: 'Invalid file ID.' });
  }
  try {
    const kb = await KnowledgeBase.findOne({ ...scope, _id: req.params.id }).lean();
    if (!kb) return res.status(404).json({ error: 'Knowledge Base not found.' });
    const file = await File.findOne(fileScope(scope, fileId)).select('_id').lean();
    if (!file) return res.status(404).json({ error: 'Indexed file not found or not owned by you.' });
    if (kb.file_ids?.includes(fileId)) return res.json(serialize(kb));
    const updated = await KnowledgeBase.findOneAndUpdate(
      {
        ...scope,
        _id: req.params.id,
        $expr: { $lt: [{ $size: '$file_ids' }, MAX_FILES] },
      },
      { $addToSet: { file_ids: fileId } },
      { new: true, runValidators: true },
    ).lean();
    if (!updated) return res.status(409).json({ error: 'Knowledge Base file limit reached.' });
    return res.json(serialize(updated));
  } catch (error) {
    return failed(res, error);
  }
});

router.delete('/:id/files/:fileId', async (req, res) => {
  const scope = requestScope(req, res);
  if (!scope) return;
  if (!validId(req.params.id) || !FILE_ID_PATTERN.test(req.params.fileId ?? '')) {
    return res.status(400).json({ error: 'Invalid ID.' });
  }
  try {
    const updated = await KnowledgeBase.findOneAndUpdate(
      { ...scope, _id: req.params.id },
      { $pull: { file_ids: req.params.fileId } },
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Knowledge Base not found.' });
    // Unlink only; NEVER delete the original file, embedding, or Agent file reference.
    return res.json(serialize(updated));
  } catch (error) {
    return failed(res, error);
  }
});

router.patch('/:id', async (req, res) => {
  const scope = requestScope(req, res);
  if (!scope) return;
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid Knowledge Base ID.' });
  const { name, description } = req.body ?? {};
  if (!validName(name) || !validDescription(description)) {
    return res.status(400).json({ error: 'Name is required (max 100 characters); description max 500.' });
  }
  try {
    const updated = await KnowledgeBase.findOneAndUpdate(
      { ...scope, _id: req.params.id },
      { $set: { name: name.trim(), description: description?.trim() ?? '' } },
      { new: true, runValidators: true },
    ).lean();
    return updated ? res.json(serialize(updated)) : res.status(404).json({ error: 'Knowledge Base not found.' });
  } catch (error) {
    return failed(res, error);
  }
});

router.delete('/:id', async (req, res) => {
  const scope = requestScope(req, res);
  if (!scope) return;
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid Knowledge Base ID.' });
  try {
    const deleted = await KnowledgeBase.findOneAndDelete({ ...scope, _id: req.params.id }).lean();
    if (!deleted) return res.status(404).json({ error: 'Knowledge Base not found.' });
    // Delete only metadata/associations. Files and RAG entries are untouched.
    return res.json({ deleted: true });
  } catch (error) {
    return failed(res, error);
  }
});

module.exports = router;
