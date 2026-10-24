const axios = require('axios');
const { logger } = require('@librechat/data-schemas');
const { tool } = require('@librechat/agents/langchain/tools');
const {
  logAxiosError,
  selectFileCitationSources,
  generateShortLivedToken,
  executeFileSearchQuery,
} = require('@librechat/api');
const { Tools, EToolResources } = require('librechat-data-provider');
const { filterFilesByAgentAccess } = require('~/server/services/Files/permissions');
const { getFiles } = require('~/models');
const { resolveAgentKnowledgeFiles } = require('~/server/services/KnowledgeBase/agentAccess');
const { resolveChatKnowledgeFiles } = require('~/server/services/KnowledgeBase/chatAccess');

const fileSearchJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        "A natural language query to search for relevant information in the files. Be specific and use keywords related to the information you're looking for. The query will be used for semantic similarity matching against the file contents.",
    },
  },
  required: ['query'],
};

/**
 *
 * @param {Object} options
 * @param {ServerRequest} options.req
 * @param {Agent['tool_resources']} options.tool_resources
 * @param {string} [options.agentId] - The agent ID for file access control
 * @param {string} [options.agentResourceType] - Permission resource type for the authorized agent route
 * @returns {Promise<{
 *   files: Array<{ file_id: string; filename: string; fromAgent: boolean }>,
 *   toolContext: string
 * }>}
 */
const primeFiles = async (options) => {
  const { tool_resources, req, agentId, agentResourceType } = options;
  const file_ids = tool_resources?.[EToolResources.file_search]?.file_ids ?? [];
  const agentResourceIds = new Set(file_ids);
  const resourceFiles = tool_resources?.[EToolResources.file_search]?.files ?? [];

  // Get all files first
  const allFiles = (await getFiles({ file_id: { $in: file_ids } }, null, { text: 0 })) ?? [];

  // Filter by access if user and agent are provided
  let dbFiles;
  if (req?.user?.id && agentId) {
    dbFiles = await filterFilesByAgentAccess({
      files: allFiles,
      userId: req.user.id,
      role: req.user.role,
      agentId,
      resourceType: agentResourceType,
    });
  } else {
    dbFiles = allFiles;
  }

  dbFiles = dbFiles.concat(resourceFiles);

  // KB selection is opt-in and checked against a saved owner/tenant conversation.
  // Agents use V3 grants; regular chats require an explicit V4.2 selection.
  // Existing directly attached files are unchanged.
  if (req?.user?.id) {
    const kbFiles = agentId
      ? await resolveAgentKnowledgeFiles({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          conversationId: req.body?.conversationId,
          agentId,
        })
      : await resolveChatKnowledgeFiles({
          userId: req.user.id,
          tenantId: req.user.tenantId,
          conversationId: req.body?.conversationId,
        });
    const existingIds = new Set(dbFiles.map((f) => f.file_id));
    for (const file of kbFiles) {
      if (!existingIds.has(file.file_id)) {
        dbFiles.push(file);
        existingIds.add(file.file_id);
      }
    }
  }

  let toolContext = `- Note: Semantic search is available through the ${Tools.file_search} tool but no files are currently loaded. Request the user to upload documents to search through.`;

  const files = [];
  for (let i = 0; i < dbFiles.length; i++) {
    const file = dbFiles[i];
    if (!file) {
      continue;
    }
    if (i === 0) {
      toolContext = `- Note: Use the ${Tools.file_search} tool to find relevant information within:`;
    }
    toolContext += `\n\t- ${file.filename}${
      file.kbManaged ? ' (Knowledge Base)' : agentResourceIds.has(file.file_id) ? '' : ' (just attached by user)'
    }`;
    files.push({
      file_id: file.file_id,
      filename: file.filename,
      // Direct resource files use the current Agent namespace. KB-linked
      // files use their independently verified original embedding namespace.
      fromAgent: agentResourceIds.has(file.file_id) || Boolean(file.ragEntityId),
      ...(file.kbManaged ? { kbManaged: true } : {}),
      ...(file.ragEntityId ? { ragEntityId: file.ragEntityId } : {}),
    });
  }

  return { files, toolContext };
};

/**
 *
 * @param {Object} options
 * @param {AppConfig} [options.appConfig]
 * @param {string} options.userId
 * @param {Array<{ file_id: string; filename: string; fromAgent?: boolean }>} options.files
 * @param {string} [options.entity_id]
 * @param {boolean} [options.fileCitations=false] - Whether to include citation instructions
 * @returns
 */
const createFileSearchTool = async ({
  userId,
  files,
  entity_id,
  tenantId,
  conversationId,
  fileCitations = false,
  appConfig,
}) => {
  return tool(
    async ({ query }) => {
      // Reauthorize the KB subset immediately before each RAG query. A revoked
      // grant never persists just because a tool was primed earlier in the turn.
      let currentFiles = files;
      if (files.some((f) => f.kbManaged)) {
        const authorized = entity_id
          ? await resolveAgentKnowledgeFiles({
              agentId: entity_id,
              userId,
              tenantId,
              conversationId,
            })
          : await resolveChatKnowledgeFiles({ userId, tenantId, conversationId });
        const allowed = new Map(authorized.map((f) => [f.file_id, f]));
        currentFiles = files.flatMap((file) => {
          if (!file.kbManaged) return [file];
          const fresh = allowed.get(file.file_id);
          if (!fresh) return [];
          return [{
            ...file,
            fromAgent: Boolean(fresh.ragEntityId),
            ...(fresh.ragEntityId ? { ragEntityId: fresh.ragEntityId } : {}),
            // Removing this stale field matters when a file was reindexed
            // into user scope between priming and retrieval.
            ...(!fresh.ragEntityId ? { ragEntityId: undefined } : {}),
          }];
        });
      }
      // The existing @librechat/api query handler uses one entity_id per
      // request. Run it once per verified vector namespace instead of
      // passing the current Agent ID for all KB-origin files.
      const groups = new Map();
      for (const file of currentFiles) {
        const namespace = file.kbManaged
          ? (file.ragEntityId ?? '')
          : (file.fromAgent ? (entity_id ?? '') : '');
        if (!groups.has(namespace)) groups.set(namespace, []);
        groups.get(namespace).push(file);
      }
      const search = (namespace, scopedFiles) => executeFileSearchQuery({
        query,
        userId,
        // Authorization is complete above. Feed only basic search fields to
        // support both installed @librechat/api builds and updated source:
        // some older builds treat kbManaged as an automatic user-scope hint.
        files: scopedFiles.map((file) => ({
          file_id: file.file_id,
          filename: file.filename,
          fromAgent: file.fromAgent,
        })),
        entity_id: namespace || undefined,
        fileCitations,
        appConfig,
        ragApiUrl: process.env.RAG_API_URL,
        httpClient: axios,
        generateShortLivedToken,
        logAxiosError,
        selectFileCitationSources,
        logger,
      });
      if (!groups.size) return search('', []);
      if (groups.size === 1) {
        const [namespace, groupFiles] = groups.entries().next().value;
        return search(namespace, groupFiles);
      }
      // Preserve old citations when multiple separately authorized source
      // namespaces contribute results to a single tool call.
      const responses = await Promise.all([...groups].map(([namespace, scopedFiles]) =>
        search(namespace, scopedFiles),
      ));
      const sources = [];
      const chunks = [];
      for (const [content, artifact] of responses) {
        const shift = sources.length;
        const currentSources = artifact?.[Tools.file_search]?.sources ?? [];
        chunks.push(content.replace(/\\ue202turn0file(\d+)/g, (_match, n) =>
          `\\ue202turn0file${Number(n) + shift}`));
        sources.push(...currentSources);
      }
      return [
        chunks.join('\n---\n'),
        sources.length
          ? { [Tools.file_search]: { sources, fileCitations } }
          : undefined,
      ];
    },
    {
      name: Tools.file_search,
      responseFormat: 'content_and_artifact',
      description: `Performs semantic search across attached "${Tools.file_search}" documents using natural language queries. This tool analyzes the content of uploaded files to find relevant information, quotes, and passages that best match your query. Use this to extract specific information or find relevant sections within the available documents.${
        fileCitations
          ? `

**CITE FILE SEARCH RESULTS:**
Use the EXACT anchor markers shown below (copy them verbatim) immediately after statements derived from file content. Reference the filename in your text:
- File citation: "The document.pdf states that... \\ue202turn0file0"  
- Page reference: "According to report.docx... \\ue202turn0file1"
- Multi-file: "Multiple sources confirm... \\ue200\\ue202turn0file0\\ue202turn0file1\\ue201"

**CRITICAL:** Output these escape sequences EXACTLY as shown (e.g., \\ue202turn0file0). Do NOT substitute with other characters like † or similar symbols.
**ALWAYS mention the filename in your text before the citation marker. NEVER use markdown links or footnotes.**`
          : ''
      }`,
      schema: fileSearchJsonSchema,
    },
  );
};

module.exports = { createFileSearchTool, primeFiles, fileSearchJsonSchema };
