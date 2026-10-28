import { isSavedEmptyConversation } from './isSavedEmptyConversation';

const savedEmpty = {
  conversationId: 'aeed40ad-2df2-5887-a053-1f351d29b3cf',
  activeConversationId: 'aeed40ad-2df2-5887-a053-1f351d29b3cf',
  messages: [],
  isLoading: false,
  routePending: false,
};

describe('MINE KB V4.3 saved conversation without first message', () => {
  it('allows the normal composer/landing view for an already-loaded empty saved chat', () => {
    expect(isSavedEmptyConversation(savedEmpty)).toBe(true);
  });

  it('never treats a still-loading history request as an empty conversation', () => {
    expect(isSavedEmptyConversation({ ...savedEmpty, isLoading: true })).toBe(false);
    expect(isSavedEmptyConversation({ ...savedEmpty, messages: null })).toBe(false);
  });

  it('never treats a previous active conversation as the new route', () => {
    expect(isSavedEmptyConversation({ ...savedEmpty, activeConversationId: 'other-chat' })).toBe(false);
    expect(isSavedEmptyConversation({ ...savedEmpty, routePending: true })).toBe(false);
  });

  it('does not override the existing New Chat or a conversation with messages', () => {
    expect(isSavedEmptyConversation({ ...savedEmpty, conversationId: 'new' })).toBe(false);
    expect(isSavedEmptyConversation({ ...savedEmpty, messages: [{ messageId: 'first' }] })).toBe(false);
    expect(isSavedEmptyConversation({ ...savedEmpty, conversationId: undefined })).toBe(false);
  });
});
