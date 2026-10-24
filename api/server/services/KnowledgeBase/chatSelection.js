const mongoose = require('mongoose');

const selectionSchema = new mongoose.Schema(
  {
    owner: { type: String, required: true, index: true },
    tenantId: { type: String, default: null, index: true },
    conversationId: { type: String, required: true },
    agentId: { type: String, required: true },
    libraries: {
      type: [{
        kb_id: { type: String, required: true },
        tags: { type: [String], default: [] },
      }],
      default: [],
    },
  },
  { timestamps: true },
);
selectionSchema.index(
  { owner: 1, tenantId: 1, conversationId: 1, agentId: 1 },
  { unique: true },
);

module.exports =
  mongoose.models.MineChatKnowledgeSelection ||
  mongoose.model('MineChatKnowledgeSelection', selectionSchema, 'minechatknowledgeselections');
