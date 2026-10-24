const mongoose = require('mongoose');

/**
 * MINE KB V2 storage only. No chat/agent retrieval is authorized by a KB entry.
 * Every route scopes by owner + explicit tenantId, including legacy single-tenant (null).
 */
const schema = new mongoose.Schema(
  {
    owner: { type: String, required: true, index: true },
    tenantId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    // Tags are scoped to a file's association with this specific KB,
    // not applied globally to the underlying RAG document.
    // Opt-in Agent access is scoped to this KB and its owner. No Agent grants by default.
    // Tags empty => all KB-linked files; nonempty => files with ANY chosen tag.
    agent_access: {
      type: [
        new mongoose.Schema(
          {
            agent_id: { type: String, required: true },
            tags: { type: [String], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    file_tags: {
      type: [
        new mongoose.Schema(
          {
            file_id: { type: String, required: true },
            tags: {
              type: [String],
              default: [],
              validate: {
                validator: (items) =>
                  Array.isArray(items) &&
                  items.length <= 10 &&
                  items.every((tag) => typeof tag === 'string' && tag.length <= 32),
                message: 'At most 10 tags of 32 characters each are allowed',
              },
            },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    file_ids: {
      type: [String],
      default: [],
      validate: {
        validator: (ids) => Array.isArray(ids) && ids.length <= 250,
        message: 'Knowledge Base supports up to 250 file references',
      },
    },
  },
  { timestamps: true },
);
schema.index({ tenantId: 1, owner: 1, updatedAt: -1 });
schema.index({ tenantId: 1, owner: 1, 'agent_access.agent_id': 1 });

module.exports =
  mongoose.models.MineKnowledgeBase ||
  mongoose.model('MineKnowledgeBase', schema, 'mineknowledgebases');
