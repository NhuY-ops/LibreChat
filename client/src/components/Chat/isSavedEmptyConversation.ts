/**
 * V4.3 prepares an owner-owned conversation with an explicit KB selection
 * BEFORE the first message. Such a saved chat has no messages by design.
 *
 * A loaded, empty, currently active saved conversation may show the ordinary
 * landing composer instead of being mistaken for a still-navigating chat.
 * Do not treat an unresolved message query, a mismatched route, or a pending
 * conversation route as an empty saved conversation.
 */
export function isSavedEmptyConversation({
  conversationId,
  activeConversationId,
  messages,
  isLoading,
  routePending,
}: {
  conversationId?: string;
  activeConversationId?: string;
  messages: readonly unknown[] | null;
  isLoading: boolean;
  routePending: boolean;
}): boolean {
  return Boolean(
    conversationId &&
    conversationId !== 'new' &&
    activeConversationId === conversationId &&
    !routePending &&
    !isLoading &&
    Array.isArray(messages) &&
    messages.length === 0,
  );
}
