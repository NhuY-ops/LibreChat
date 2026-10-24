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

  // A KB is opt-in, and only the actual owner of both Agent and KB can
  // retrieve its content. Existing direct File Search attachments are untouched.
  if (req?.user?.id && agentId) {
    const kbFiles = await resolveAgentKnowledgeFiles({
      userId: req.user.id,
      tenantId: req.user.tenantId,
      agentId,
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
      // KB-managed files are already indexed in the *user* namespace.
      // fromAgent would incorrectly target this Agent's vector namespace.
      // Direct Agent resource files retain their original namespace.
      fromAgent: agentResourceIds.has(file.file_id),
      ...(file.kbManaged ? { kbManaged: true } : {}),
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
  fileCitations = false,
  appConfig,
}) => {
  return tool(
    async ({ query }) => {
      // Reauthorize the KB subset immediately before each RAG query. A revoked
      // grant never persists just because a tool was primed earlier in the turn.
      let currentFiles = files;
      if (files.some((f) => f.kbManaged)) {
        const authorized = await resolveAgentKnowledgeFiles({
          agentId: entity_id,
          userId,
          tenantId,
        });
        const allowed = new Set(authorized.map((f) => f.file_id));
        currentFiles = files.filter((f) => !f.kbManaged || allowed.has(f.file_id));
      }
      return executeFileSearchQuery({
        query,
        userId,
        files: currentFiles,
        entity_id,
        fileCitations,
        appConfig,
        ragApiUrl: process.env.RAG_API_URL,
        httpClient: axios,
        generateShortLivedToken,
        logAxiosError,
        selectFileCitationSources,
        logger,
      });
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
