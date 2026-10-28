import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Database } from 'lucide-react';
import { Constants, apiBaseUrl, request } from 'librechat-data-provider';
import type { TConversation } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import useNavigateToConvo from '~/hooks/Conversations/useNavigateToConvo';

type AvailableLibrary = {
  kb_id: string;
  name: string;
  file_count: number;
  agent_tags: string[];
};
type SelectedLibrary = { kb_id: string; tags: string[] };
type ChatKnowledgeSettings = {
  available: AvailableLibrary[];
  selected: SelectedLibrary[];
  inherited: boolean;
};
type DraftValue = { enabled: boolean; tags: string };

const url = (conversationId: string) =>
  `${apiBaseUrl()}/api/knowledge/chat/${encodeURIComponent(conversationId)}`;
const newCatalogUrl = () => `${apiBaseUrl()}/api/knowledge/chat/new/available`;
const prepareUrl = () => `${apiBaseUrl()}/api/knowledge/chat/prepare`;

function parseTags(text: string): string[] | null {
  const tags = [...new Set(text.split(',')
    .map((tag) => tag.normalize('NFKC').trim().toLowerCase())
    .filter(Boolean))];
  if (tags.length > 10 || tags.some((tag) => tag.length > 32)) return null;
  return tags;
}

/**
 * V4.3: New regular chats can prepare a saved, owner-authorized KB selection
 * before the first message. Existing Agent/regular chats retain V4.2 behavior.
 * The prepare endpoint returns a ready conversation only after saving the KB set.
 */
export default function ChatKnowledgePicker({
  conversationId,
  agentId,
  conversation,
  index,
  disabled = false,
}: {
  conversationId: string;
  agentId?: string | null;
  conversation?: TConversation | null;
  index: number;
  disabled?: boolean;
}) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const form = useChatFormContext();
  const { navigateToConvo } = useNavigateToConvo(index);
  const principal = user?.id ?? '';
  const isNew = conversationId === 'new' || conversationId === Constants.NEW_CONVO;
  const prepareNew = isNew && !agentId;
  const ready = Boolean(principal && conversationId && (!isNew || prepareNew));
  const queryKey = ['mineChatKB', principal, conversationId, agentId];
  const requestKey = useRef<string>(crypto.randomUUID());
  const query = useQuery<ChatKnowledgeSettings>(
    queryKey,
    () => request.get(prepareNew ? newCatalogUrl() : url(conversationId)),
    { enabled: ready, retry: false, refetchOnWindowFocus: false },
  );
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popupPlacement, setPopupPlacement] = useState<{
    left: number;
    bottom: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [draft, setDraft] = useState<Record<string, DraftValue>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const data = query.data;
    if (!data) {
      setDraft({});
      return;
    }
    const selected = new Map<string, string[]>(
      data.selected.map((entry): [string, string[]] => [entry.kb_id, entry.tags]),
    );
    setDraft(Object.fromEntries(data.available.map((kb) => [
      kb.kb_id,
      { enabled: selected.has(kb.kb_id), tags: (selected.get(kb.kb_id) ?? []).join(', ') },
    ])));
    setError('');
  }, [query.data, conversationId, agentId]);

  // The composer surface clips overflowing children; render the KB picker
  // through a portal so the options remain visible above the composer.
  useEffect(() => {
    if (!open || !ready) {
      setPopupPlacement(null);
      return;
    }
    const placePopup = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const bounds = trigger.getBoundingClientRect();
      const width = Math.min(352, window.innerWidth - 16);
      setPopupPlacement({
        left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
        bottom: Math.max(8, window.innerHeight - bounds.top + 8),
        width,
        maxHeight: Math.max(80, bounds.top - 16),
      });
    };
    placePopup();
    window.addEventListener('resize', placePopup);
    window.addEventListener('scroll', placePopup, true);
    return () => {
      window.removeEventListener('resize', placePopup);
      window.removeEventListener('scroll', placePopup, true);
    };
  }, [open, ready]);

  const count = useMemo(
    () => Object.values(draft).filter((item) => item.enabled).length,
    [draft],
  );
  const save = async () => {
    if (!ready || pending || !query.data) return;
    const libraries: SelectedLibrary[] = [];
    for (const kb of query.data.available) {
      const selected = draft[kb.kb_id];
      if (!selected?.enabled) continue;
      const tags = parseTags(selected.tags);
      if (tags === null) {
        setError('Use up to 10 comma-separated tags (32 characters each).');
        return;
      }
      libraries.push({ kb_id: kb.kb_id, tags });
    }
    setPending(true);
    setError('');
    try {
      if (prepareNew) {
        if (!conversation?.endpoint || !conversation?.model) {
          setError('Choose a model before preparing the first KB-enabled chat.');
          return;
        }
        // Preparing a chat navigates away from the shared "new" draft. Never
        // silently discard text the user already typed in that draft.
        if (form.getValues('text')?.trim()) {
          setError('Save or copy your unsent text, then clear it and select KBs before typing your first message.');
          return;
        }
        const prepared: { conversationId: string; endpoint: string; model: string } =
          await request.post(prepareUrl(), {
            requestKey: requestKey.current,
            endpoint: conversation.endpoint,
            model: conversation.model,
            libraries,
          });
        if (!prepared?.conversationId) throw new Error('No prepared conversation ID returned.');
        queryClient.setQueryData(['mineChatKB', principal, prepared.conversationId, null], {
          available: query.data.available,
          selected: libraries,
          inherited: false,
        });
        setOpen(false);
        navigateToConvo({
          ...conversation,
          title: 'New Chat',
          conversationId: prepared.conversationId,
          // Preserve the already typed TConversation endpoint. The server
          // validated that prepared.endpoint/model match these inputs.
          endpoint: conversation.endpoint,
          model: conversation.model,
          agent_id: undefined,
        }, { currentConvoId: conversationId });
      } else {
        await request.put(url(conversationId), { libraries });
        await queryClient.invalidateQueries(queryKey);
        setOpen(false);
      }
    } catch (caught) {
      const failure = caught as { response?: { data?: { error?: string } }; message?: string };
      setError(failure.response?.data?.error ?? failure.message ?? 'Could not save Chat Knowledge Bases.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || !ready}
        aria-label="Chat Knowledge Bases"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title={ready ? (prepareNew ? 'Choose KBs before your first message' : 'Choose Knowledge Bases for this chat') : 'Start a saved Agent chat to enable KBs'}
        className="border-border-medium text-text-secondary hover:bg-surface-hover flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Database className="size-3.5" aria-hidden="true" />
        <span>KB {ready ? count : '—'}</span>
        <ChevronDown className="size-3" aria-hidden="true" />
      </button>
      {open && ready && popupPlacement && createPortal(
        <div
          role="dialog"
          aria-label="Knowledge Bases for this conversation"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
          style={popupPlacement}
          className="border-border-medium bg-surface-primary fixed z-[100] overflow-y-auto rounded-xl border p-3 shadow-xl"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-text-primary text-sm font-semibold">Chat Knowledge Bases</h3>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close KB picker"
              className="text-text-secondary text-xs">Close</button>
          </div>
          <p className="text-text-secondary mt-1 text-xs">
            {agentId ? 'Only libraries already granted to this Agent.' : prepareNew ? 'Choose private KBs now, then type your first message in the prepared chat.' : 'Choose your own private Knowledge Bases.'} Changes apply to this chat only.
          </p>
          {query.isLoading ? (
            <p role="status" className="text-text-secondary py-3 text-xs">Loading KBs…</p>
          ) : query.isError ? (
            <p role="alert" className="text-text-destructive py-3 text-xs">Could not load Chat KBs.</p>
          ) : !query.data?.available.length ? (
            <p className="text-text-secondary py-3 text-xs">
              {agentId ? 'No granted KBs. Enable one in Agent Builder first.' : 'No private Knowledge Bases found. Create one in Knowledge Bases first.'}
            </p>
          ) : (
            <div className="mt-3 max-h-64 space-y-3 overflow-y-auto">
              {query.data.available.map((kb) => (
                <div className="border-border-light rounded-lg border p-2" key={kb.kb_id}>
                  <label className="flex cursor-pointer items-start gap-2 text-xs">
                    <input type="checkbox"
                      aria-label={`Search ${kb.name} in this conversation`}
                      checked={draft[kb.kb_id]?.enabled ?? false}
                      disabled={pending}
                      onChange={(event) => setDraft((old) => ({
                        ...old,
                        [kb.kb_id]: { ...(old[kb.kb_id] ?? { tags: '' }), enabled: event.target.checked },
                      }))}
                    />
                    <span>
                      <span className="text-text-primary block font-medium">{kb.name}</span>
                      <span className="text-text-secondary block">
                        {kb.file_count} file(s)
                        {kb.agent_tags.length ? ` · Agent tags: ${kb.agent_tags.join(', ')}` : ''}
                      </span>
                    </span>
                  </label>
                  {draft[kb.kb_id]?.enabled && (
                    <label className="text-text-secondary mt-2 block text-xs">
                      Further filter by tags (optional)
                      <input type="text" maxLength={329}
                        aria-label={`Chat tag filter for ${kb.name}`}
                        value={draft[kb.kb_id]?.tags ?? ''}
                        placeholder="immunology, clinical"
                        disabled={pending}
                        onChange={(event) => setDraft((old) => ({
                          ...old, [kb.kb_id]: { enabled: true, tags: event.target.value },
                        }))}
                        className="border-border-medium bg-surface-secondary text-text-primary mt-1 w-full rounded-md border px-2 py-1.5 text-xs"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}
          {error && <p role="alert" className="text-text-destructive mt-2 text-xs">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button type="button" onClick={() => void save()}
              disabled={pending || !query.data}
              className="bg-surface-tertiary text-text-primary hover:bg-surface-hover rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50">
              {pending ? 'Saving…' : prepareNew ? 'Prepare chat with KBs' : 'Save for this chat'}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
