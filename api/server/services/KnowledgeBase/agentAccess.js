const { getTenantId, SYSTEM_TENANT_ID, logger } = require('@librechat/data-schemas');
const { Agent, File } = require('~/db/models');
const KnowledgeBase = require('./model');

const MAX_KB_FILES_PER_TURN = 500;

/**
 * File-level tag match uses OR semantics; [] means every document in that KB.
 * A KB grant is scoped per Agent and per document's membership of that KB.
 * This helper is pure, enabling repeatable tests without an active Mongo server.
 */
function grantedFileIds(libraries, agentId) {
  const ids = new Set();
  for (const kb of libraries) {
    const grant = (kb.agent_access ?? []).find((g) => g.agent_id === agentId);
    if (!grant) continue;
    const allowedTags = Array.isArray(grant.tags) ? grant.tags : [];
    const tagLookup = new Map((kb.file_tags ?? []).map((t) => [t.file_id, t.tags ?? []]));
    for (const id of kb.file_ids ?? []) {
      if (allowedTags.length && !(tagLookup.get(id) ?? []).some((t) => allowedTags.includes(t))) {
        continue;
      }
      ids.add(id);
      if (ids.size >= MAX_KB_FILES_PER_TURN) return [...ids];
    }
  }
  return [...ids];
}

/**
 * No KB files for shared Agents, deleted Agents, other owners, other tenants,
 * invalid/expired/unembedded files, or requests without a valid Agent.
 * Never fail open on database or tenant-scoping errors.
 */
async function resolveAgentKnowledgeFiles({ agentId, userId, tenantId }) {
  if (typeof agentId !== 'string' || !agentId.startsWith('agent_') || !userId) return [];
  const requestTenant = getTenantId() ?? null;
  // If a propagated tenant differs from the request user tenant, deny rather
  // than trusting either one and risking a cross-tenant KB lookup.
  if (requestTenant && tenantId && requestTenant !== tenantId) return [];
  const scopedTenant = requestTenant ?? tenantId ?? null;
  if (scopedTenant === SYSTEM_TENANT_ID ||
      (process.env.TENANT_ISOLATION_STRICT === 'true' && !scopedTenant)) return [];
  const scope = { owner: String(userId), tenantId: scopedTenant };
  try {
    const agent = await Agent.findOne({
      id: agentId,
      author: String(userId),
      tenantId: scopedTenant,
    }).select('_id').lean();
    if (!agent) return [];
    const libraries = await KnowledgeBase.find({
      ...scope,
      'agent_access.agent_id': agentId,
    }).select('file_ids file_tags agent_access').lean();
    const permitted = grantedFileIds(libraries, agentId);
    if (!permitted.length) return [];
    const files = await File.find({
      user: scope.owner,
      tenantId: scope.tenantId,
      file_id: { $in: permitted },
      embedded: true,
      $or: [{ expiredAt: null }, { expiredAt: { $gt: new Date() } }],
    }).select('file_id filename user context metadata.embeddedEntities').lean();
    const ownedById = new Map(files.map((f) => [f.file_id, f]));
    // Files originally uploaded to another Agent live in that Agent's vector
    // namespace. Never trust metadata alone as authorization: verify the
    // namespace belongs to an Agent with the same owner AND tenant.
    const sourceAgentIds = [...new Set(files
      .filter((file) => file.context === 'agents')
      .flatMap((file) => file.metadata?.embeddedEntities ?? [])
      .filter((id) => typeof id === 'string' && /^agent_[a-zA-Z0-9_-]{1,150}$/.test(id)))];
    const ownedSourceIds = new Set();
    if (sourceAgentIds.length) {
      const sourceAgents = await Agent.find({
        id: { $in: sourceAgentIds },
        author: scope.owner,
        tenantId: scope.tenantId,
      }).select('id').lean();
      for (const source of sourceAgents) ownedSourceIds.add(source.id);
    }
    return permitted.flatMap((id) => {
      const file = ownedById.get(id);
      if (!file) return [];
      let ragEntityId;
      if (file.context === 'agents') {
        // Fail closed if the original Agent was removed or belongs to anyone
        // else. A stale or foreign namespace must never be guessed/fallback.
        ragEntityId = (file.metadata?.embeddedEntities ?? []).find((sourceId) =>
          ownedSourceIds.has(sourceId),
        );
        if (!ragEntityId) return [];
      }
      return [{
        file_id: id,
        filename: file.filename,
        user: file.user,
        kbManaged: true,
        ...(ragEntityId ? { ragEntityId } : {}),
      }];
    });
  } catch (error) {
    logger.error('[MINE KB] Agent document grant resolution failed', error);
    return [];
  }
}

module.exports = { grantedFileIds, resolveAgentKnowledgeFiles };
