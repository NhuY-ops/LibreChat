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

module.exports =
  mongoose.models.MineKnowledgeBase ||
  mongoose.model('MineKnowledgeBase', schema, 'mineknowledgebases');
