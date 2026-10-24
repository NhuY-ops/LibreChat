import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, ShieldCheck } from 'lucide-react';
import { apiBaseUrl, request } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';

type KnowledgeAgentGrant = { agent_id: string; tags: string[] };
type KnowledgeBaseEntry = {
  _id: string;
  name: string;
  description: string;
  file_ids: string[];
  agent_access?: KnowledgeAgentGrant[];
};

const kbUrl = () => `${apiBaseUrl()}/api/knowledge`;

function normalizeTagDraft(text: string): string[] | null {
  const pieces = text.split(',');
  if (pieces.length > 10) return null;
  const normalized: string[] = [];
  for (const piece of pieces) {
    const tag = piece.normalize('NFKC').trim().toLowerCase();
    if (!tag) continue;
    if (tag.length > 32) return null;
    if (!normalized.includes(tag)) normalized.push(tag);
  }
  return normalized;
}

/**
 * Saves KB-to-Agent grants independently of the Agent form.
 * No unsaved Agent can receive KB access; no grant exists until user opts in.
 * All file/tag retrieval enforcement lives on the server, not in this component.
 */
export default function AgentKnowledgeAccess({ agentId }: { agentId?: string }) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const principal = user?.id ?? '';
  const [draftTags, setDraftTags] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const saved = typeof agentId === 'string' && /^agent_[a-zA-Z0-9_-]+$/.test(agentId);
  const query = useQuery<KnowledgeBaseEntry[]>(
    ['mineKBs', principal],
    () => request.get(kbUrl()),
    {
      enabled: !!principal && saved,
      retry: false,
      refetchOnWindowFocus: false,
    },
  );
  const libraries = query.data ?? [];
  const activeCount = useMemo(
    () =>
      libraries.filter((kb) =>
        (kb.agent_access ?? []).some((grant) => grant.agent_id === agentId),
      ).length,
    [libraries, agentId],
  );

  const saveGrant = async (kb: KnowledgeBaseEntry, enabled: boolean) => {
    if (!agentId || savingId) return;
    const tags = enabled
      ? normalizeTagDraft(
          draftTags[kb._id] ??
            (kb.agent_access ?? []).find((grant) => grant.agent_id === agentId)?.tags.join(', ') ??
            '',
        )
      : [];
    if (tags === null) {
      setError('Use at most 10 comma-separated tags of up to 32 characters each.');
      return;
    }
    setSavingId(kb._id);
    setError('');
    setSuccessMessage('');
    try {
      await request.put(
        `${kbUrl()}/${encodeURIComponent(kb._id)}/agent-access/${encodeURIComponent(agentId)}`,
        { enabled, tags },
      );
      await queryClient.invalidateQueries(['mineKBs', principal]);
      setDraftTags((previous) => {
        const next = { ...previous };
        delete next[kb._id];
        return next;
      });
      setSuccessMessage('Knowledge Base access saved.');
    } catch (caught) {
      const failure = caught as { response?: { data?: { error?: string } } };
      setError(failure.response?.data?.error ?? 'Could not update Knowledge Base access.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="border-border-light my-3 rounded-lg border p-3" aria-label="Agent Knowledge Base Access">
      <div className="mb-2 flex items-center gap-2">
        <Database className="size-4" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Knowledge Base Access</h3>
      </div>
      <p className="text-text-secondary text-xs leading-5">
        Private opt-in RAG access. Only Knowledge Bases you explicitly enable are
        searched; optional tags use ANY matching tag. The Agent must have the
        File Search tool enabled for retrieval.
      </p>
      {!saved ? (
        <p className="text-text-secondary mt-3 text-xs">
          Save the Agent first to configure its Knowledge Base access.
        </p>
      ) : query.isLoading ? (
        <p role="status" className="text-text-secondary mt-3 text-xs">Loading Knowledge Bases…</p>
      ) : query.isError ? (
        <p role="alert" className="text-text-destructive mt-3 text-xs">
          Could not load your Knowledge Bases. Open the KB page or retry.
        </p>
      ) : libraries.length === 0 ? (
        <p className="text-text-secondary mt-3 text-xs">
          No Knowledge Bases yet. Create one from the Knowledge Base sidebar tab.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {activeCount === 0 ? 'No KB access (default)' : `${activeCount} KB(s) enabled`}
          </div>
          <div className="mt-2 space-y-3">
            {libraries.map((kb) => {
              const grant = (kb.agent_access ?? []).find((item) => item.agent_id === agentId);
              const enabled = !!grant;
              const tags = draftTags[kb._id] ?? (grant?.tags ?? []).join(', ');
              return (
                <div key={kb._id} className="border-border-light rounded-lg border p-2">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label={`Allow Agent access to ${kb.name}`}
                      checked={enabled}
                      disabled={!!savingId}
                      onChange={(event) => void saveGrant(kb, event.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{kb.name}</span>
                      <span className="text-text-secondary block text-xs">
                        {kb.file_ids.length} linked document(s)
                      </span>
                    </span>
                  </label>
                  {enabled && (
                    <div className="mt-2 ml-5">
                      <label className="text-text-secondary block text-xs" htmlFor={`kb-agent-tags-${kb._id}`}>
                        Allowed tags (optional; blank means all linked files)
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          id={`kb-agent-tags-${kb._id}`}
                          value={tags}
                          maxLength={329}
                          placeholder="e.g. immunology, clinical"
                          onChange={(event) =>
                            setDraftTags((prior) => ({ ...prior, [kb._id]: event.target.value }))
                          }
                          className="border-border-light bg-surface-secondary min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          disabled={!!savingId}
                          onClick={() => void saveGrant(kb, true)}
                          className="border-border-light rounded-md border px-2 py-1.5 text-xs disabled:opacity-50"
                        >
                          Save tags
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      {error && <p role="alert" className="text-text-destructive mt-2 text-xs">{error}</p>}
      {successMessage && (
        <p role="status" className="text-text-secondary mt-2 text-xs">{successMessage}</p>
      )}
    </section>
  );
}
