const { getTenantId, SYSTEM_TENANT_ID, logger } = require('@librechat/data-schemas');
const { isAgentsEndpoint } = require('librechat-data-provider');
const { Agent, Conversation, File } = require('~/db/models');
const KnowledgeBase = require('./model');
const ChatKnowledgeSelection = require('./chatSelection');

// This internal scope is never accepted from an API request. Agent IDs always
// start with "agent_"; a regular chat must never inherit Agent KB grants.
const REGULAR_CHAT_SCOPE = '__mine_regular_chat__';
const MAX_KB_FILES_PER_TURN = 500;
const CONVERSATION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,150}$/;

// Model changes may preserve a stale agent_id on a Groq/OpenAI/etc chat.
// The persisted endpoint, not this leftover field, owns chat mode.
function isAgentKnowledgeConversation(conversation) {
  return Boolean(conversation && isAgentsEndpoint(conversation.endpoint));
}

/**
 * Return ONLY files explicitly selected by the owner of an existing, saved,
 * non-Agent conversation. No persisted selection means no KB access.
 * Every retrieval re-checks ownership, tenant, active files, tags, and
 * historical Agent RAG namespace provenance. Never fall back to Agent grants.
 */
async function resolveChatKnowledgeFiles({ userId, tenantId, conversationId }) {
  if (!userId || typeof conversationId !== 'string' ||
      !CONVERSATION_ID_PATTERN.test(conversationId) || conversationId === 'new') return [];
  const requestTenant = getTenantId() ?? null;
  if (requestTenant && tenantId && requestTenant !== tenantId) return [];
  const scopedTenant = requestTenant ?? tenantId ?? null;
  if (scopedTenant === SYSTEM_TENANT_ID ||
      (process.env.TENANT_ISOLATION_STRICT === 'true' && !scopedTenant)) return [];
  const scope = { owner: String(userId), tenantId: scopedTenant };
  try {
    const conversation = await Conversation.findOne({
      conversationId,
      user: scope.owner,
      tenantId: scope.tenantId,
      isTemporary: { $ne: true },
    }).select('agent_id endpoint').lean();
    // Agents remain controlled exclusively by V3/V4.1 grants. A stale
    // agent_id in a regular conversation must not disable its own KB picker.
    if (!conversation || isAgentKnowledgeConversation(conversation)) return [];

    const selection = await ChatKnowledgeSelection.findOne({
      ...scope, conversationId, agentId: REGULAR_CHAT_SCOPE,
    }).lean();
    if (!selection?.libraries?.length) return [];
    const tagsByKB = new Map(selection.libraries.map((entry) =>
      [String(entry.kb_id), Array.isArray(entry.tags) ? entry.tags : []]));
    const libraries = await KnowledgeBase.find({
      ...scope,
      _id: { $in: [...tagsByKB.keys()] },
    }).select('_id file_ids file_tags').lean();
    const fileIds = new Set();
    for (const kb of libraries) {
      const chatTags = tagsByKB.get(String(kb._id));
      if (!chatTags) continue;
      const tagMap = new Map((kb.file_tags ?? []).map((entry) =>
        [entry.file_id, entry.tags ?? []]));
      for (const fileId of kb.file_ids ?? []) {
        const tags = tagMap.get(fileId) ?? [];
        if (chatTags.length && !tags.some((tag) => chatTags.includes(tag))) continue;
        fileIds.add(fileId);
        if (fileIds.size >= MAX_KB_FILES_PER_TURN) break;
      }
      if (fileIds.size >= MAX_KB_FILES_PER_TURN) break;
    }
    if (!fileIds.size) return [];
    const files = await File.find({
      user: scope.owner,
      tenantId: scope.tenantId,
      file_id: { $in: [...fileIds] },
      embedded: true,
      $or: [{ expiredAt: null }, { expiredAt: { $gt: new Date() } }],
    }).select('file_id filename user context metadata.embeddedEntities').lean();
    const originIds = [...new Set(files
      .filter((file) => file.context === 'agents')
      .flatMap((file) => file.metadata?.embeddedEntities ?? [])
      .filter((id) => typeof id === 'string' && /^agent_[a-zA-Z0-9_-]{1,150}$/.test(id)))];
    const ownedOriginIds = new Set();
    if (originIds.length) {
      const agents = await Agent.find({
        id: { $in: originIds },
        author: scope.owner,
        tenantId: scope.tenantId,
      }).select('id').lean();
      agents.forEach((agent) => ownedOriginIds.add(agent.id));
    }
    return files.flatMap((file) => {
      let ragEntityId;
      if (file.context === 'agents') {
        ragEntityId = (file.metadata?.embeddedEntities ?? []).find((id) =>
          ownedOriginIds.has(id));
        if (!ragEntityId) return [];
      }
      return [{
        file_id: file.file_id,
        filename: file.filename,
        user: file.user,
        kbManaged: true,
        ...(ragEntityId ? { ragEntityId } : {}),
      }];
    });
  } catch (error) {
    logger.error('[MINE KB] Regular chat document resolution failed', error);
    return [];
  }
}

module.exports = { REGULAR_CHAT_SCOPE, isAgentKnowledgeConversation, resolveChatKnowledgeFiles };
