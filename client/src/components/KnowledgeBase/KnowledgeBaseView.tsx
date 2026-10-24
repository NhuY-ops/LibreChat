import { useMemo, useState, type FormEvent } from 'react';
import { useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl, EModelEndpoint, request } from 'librechat-data-provider';
import type { TFile } from 'librechat-data-provider';
import {
  ArrowRight,
  Database,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  Link2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useGetFiles } from '~/data-provider';
import { useAuthContext } from '~/hooks';
import { activePanelAtom } from '~/Providers';
import { showFilesDialogAtom } from '~/store/filesDialog';
import { filterIndexedFiles } from './knowledgeFiles';

type KnowledgeBase = {
  _id: string;
  name: string;
  description: string;
  file_ids: string[];
  createdAt?: string;
  updatedAt?: string;
};

type LinkedFile = {
  file_id: string;
  filename: string;
  bytes?: number;
  type?: string;
};

const kbUrl = () => `${apiBaseUrl()}/api/knowledge`;

function getErrorText(error: unknown): string {
  const typed = error as {
    response?: { data?: { error?: string }; status?: number };
  } | null;
  return typed?.response?.data?.error ?? 'Request failed. Check that the MINE API server is running.';
}

/**
 * V2: Persisted personal KB collections; associations only, NOT a new search provider.
 * Server verifies owner, tenant and embedding state on every association/read.
 * Selecting a KB does not grant any Chat/Agent access to its files.
 */
export default function KnowledgeBaseView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  const principal = user?.id ?? '';
  const setActivePanel = useSetAtom(activePanelAtom);
  const setFilesOpen = useSetAtom(showFilesDialogAtom);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data: files = [], isLoading: filesLoading, isError: filesError, refetch: refetchFiles } =
    useGetFiles<TFile[]>();
  const librariesQuery = useQuery<KnowledgeBase[]>(
    ['mineKBs', principal],
    () => request.get(kbUrl()),
    { enabled: !!principal, retry: false, refetchOnWindowFocus: false },
  );
  const libraries = librariesQuery.data ?? [];
  const selected = libraries.find((library) => library._id === selectedId) ?? null;
  const linkedQuery = useQuery<LinkedFile[]>(
    ['mineKBFiles', principal, selectedId],
    () => request.get(`${kbUrl()}/${selectedId}/files`),
    { enabled: !!principal && !!selectedId, retry: false, refetchOnWindowFocus: false },
  );
  const linkedFiles = linkedQuery.data ?? [];
  const linkedIds = useMemo(() => new Set(selected?.file_ids ?? []), [selected?.file_ids]);
  const indexedFiles = useMemo(() => filterIndexedFiles(files), [files]);
  const visibleFiles = useMemo(() => filterIndexedFiles(files, search), [files, search]);
  const otherCount = files.filter((file) => file.embedded !== true).length;

  const refreshKBs = async () => {
    await Promise.all([
      queryClient.invalidateQueries(['mineKBs', principal]),
      queryClient.invalidateQueries(['mineKBFiles', principal]),
    ]);
  };

  const perform = async (operation: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setActionError('');
    try {
      await operation();
      await refreshKBs();
    } catch (error) {
      setActionError(getErrorText(error));
    } finally {
      setPending(false);
    }
  };

  const createKB = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    await perform(async () => {
      const created = (await request.post(kbUrl(), {
        name: name.trim(),
        description: description.trim(),
      })) as KnowledgeBase;
      setSelectedId(created._id);
      setName('');
      setDescription('');
      setShowCreate(false);
    });
  };

  const addFile = async (fileId: string) => {
    if (!selectedId) return;
    await perform(async () => {
      await request.post(`${kbUrl()}/${selectedId}/files`, { file_id: fileId });
    });
  };

  const removeFile = async (fileId: string) => {
    if (!selectedId) return;
    await perform(async () => {
      await request.delete(`${kbUrl()}/${selectedId}/files/${encodeURIComponent(fileId)}`);
    });
  };

  const deleteKB = async (libraryId: string) => {
    await perform(async () => {
      await request.delete(`${kbUrl()}/${libraryId}`);
      if (selectedId === libraryId) setSelectedId(null);
      setConfirmDeleteId(null);
    });
  };

  const openAgentBuilder = () => {
    setActivePanel(EModelEndpoint.agents);
    navigate('/c/new');
  };

  return (
    <main className="bg-surface-primary text-text-primary h-full min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-text-secondary mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <Database className="size-4" aria-hidden="true" /> MINE Knowledge
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
            <p className="text-text-secondary mt-2 max-w-2xl text-sm leading-6">
              Organize your indexed files in private Knowledge Bases. These collections
              do not yet grant any Agent or Chat access; existing File Search remains unchanged.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilesOpen(true)}
            className="border-border-light bg-surface-secondary hover:bg-surface-hover inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
          >
            <FolderOpen className="size-4" aria-hidden="true" /> Manage my files
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2" aria-label="Knowledge file status">
          <div className="border-border-light rounded-xl border p-4">
            <p className="text-text-secondary text-sm">Indexed for retrieval</p>
            <p className="mt-2 text-2xl font-semibold" data-testid="kb-indexed-count">
              {filesLoading ? '—' : indexedFiles.length}
            </p>
            <p className="text-text-secondary mt-1 text-xs">Existing RAG-indexed documents</p>
          </div>
          <div className="border-border-light rounded-xl border p-4">
            <p className="text-text-secondary text-sm">Other uploaded files</p>
            <p className="mt-2 text-2xl font-semibold">{filesLoading ? '—' : otherCount}</p>
            <p className="text-text-secondary mt-1 text-xs">Not marked indexed (including media)</p>
          </div>
        </section>

        <section className="border-border-light overflow-hidden rounded-xl border" aria-label="My Knowledge Bases">
          <div className="border-border-light flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <h2 className="text-base font-semibold">My Knowledge Bases</h2>
              <p className="text-text-secondary mt-1 text-xs">
                Saved in MINE's database; private to your account and tenant
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="bg-surface-secondary border-border-light hover:bg-surface-hover inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"
            >
              <Plus className="size-4" aria-hidden="true" /> Create KB
            </button>
          </div>
          {showCreate && (
            <form onSubmit={(event) => void createKB(event)} className="border-border-light grid gap-3 border-b p-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Knowledge Base name
                <input
                  autoFocus
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Medical Research"
                  className="bg-surface-secondary border-border-light rounded-lg border px-3 py-2 font-normal"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Description (optional)
                <input
                  maxLength={500}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What belongs in this knowledge base?"
                  className="bg-surface-secondary border-border-light rounded-lg border px-3 py-2 font-normal"
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={pending || !name.trim()}
                  className="bg-surface-tertiary hover:bg-surface-hover rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {pending ? 'Saving…' : 'Create Knowledge Base'}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg px-3 py-2 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          )}
          {actionError && <p role="alert" className="text-text-destructive px-4 py-3 text-sm">{actionError}</p>}
          {librariesQuery.isLoading ? (
            <p role="status" className="text-text-secondary p-5 text-sm">Loading your Knowledge Bases…</p>
          ) : librariesQuery.isError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 p-5">
              <p className="text-text-secondary text-sm">
                Could not load Knowledge Bases. Restart the updated API backend if it is still running older code.
              </p>
              <button type="button" onClick={() => void librariesQuery.refetch()} className="rounded-lg border px-3 py-2 text-sm">
                <RefreshCw className="mr-1 inline size-4" aria-hidden="true" /> Retry
              </button>
            </div>
          ) : libraries.length === 0 ? (
            <div className="flex flex-col items-start gap-2 p-5">
              <Folder className="text-text-secondary size-6" aria-hidden="true" />
              <p className="text-sm font-medium">No Knowledge Bases yet</p>
              <p className="text-text-secondary text-sm">Create a private library, then add indexed files from your account.</p>
            </div>
          ) : (
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {libraries.map((library) => (
                <div key={library._id} className={`rounded-xl border p-3 ${selectedId === library._id ? 'border-border-heavy bg-surface-secondary' : 'border-border-light'}`}>
                  <button
                    type="button"
                    onClick={() => { setSelectedId(library._id); setConfirmDeleteId(null); }}
                    className="w-full text-left"
                    aria-pressed={selectedId === library._id}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Folder className="size-4 shrink-0" aria-hidden="true" /> {library.name}
                    </span>
                    {library.description && <span className="text-text-secondary mt-1 block text-xs">{library.description}</span>}
                    <span className="text-text-secondary mt-2 block text-xs">{library.file_ids.length} linked documents</span>
                  </button>
                  <div className="mt-3 flex items-center gap-2">
                    {confirmDeleteId === library._id ? (
                      <>
                        <span className="text-text-secondary text-xs">Delete library only?</span>
                        <button type="button" disabled={pending} onClick={() => void deleteKB(library._id)} className="text-text-destructive text-xs font-semibold">
                          Confirm
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-xs">Cancel</button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(library._id)}
                        className="text-text-secondary inline-flex items-center gap-1 text-xs"
                        aria-label={`Delete ${library.name} library only`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" /> Delete library
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {selected && (
          <section className="border-border-light overflow-hidden rounded-xl border" aria-label="Selected Knowledge Base documents">
            <div className="border-border-light flex items-center justify-between gap-3 border-b p-4">
              <div>
                <h2 className="text-base font-semibold">{selected.name} — Documents</h2>
                <p className="text-text-secondary mt-1 text-xs">
                  References only. Removing a reference never deletes the source file.
                </p>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Close Knowledge Base" className="rounded-md p-1">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            {linkedQuery.isLoading ? (
              <p role="status" className="text-text-secondary p-4 text-sm">Loading linked documents…</p>
            ) : linkedQuery.isError ? (
              <p role="alert" className="text-text-destructive p-4 text-sm">
                Could not load documents for this Knowledge Base.
              </p>
            ) : linkedFiles.length === 0 ? (
              <p className="text-text-secondary p-4 text-sm">No accessible indexed documents in this library yet.</p>
            ) : (
              <ul className="divide-border-light divide-y">
                {linkedFiles.map((file) => (
                  <li key={file.file_id} className="flex min-w-0 items-center gap-3 p-3">
                    <FileText className="text-text-secondary size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-sm" title={file.filename}>{file.filename}</span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void removeFile(file.file_id)}
                      className="text-text-secondary shrink-0 text-xs underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-text-secondary border-border-light border-t p-3 text-xs">
              These files are not automatically shared with Chat or any Agent.
            </p>
          </section>
        )}

        <section className="border-border-light overflow-hidden rounded-xl border" aria-label="Indexed documents">
          <div className="border-border-light flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <h2 className="text-base font-semibold">Indexed documents</h2>
              <p className="text-text-secondary mt-1 text-xs">
                {selected ? `Add an existing file to ${selected.name}` : 'Select a Knowledge Base above to link documents'}
              </p>
            </div>
            <label className="border-border-light bg-surface-secondary flex w-full items-center gap-2 rounded-lg border px-3 py-2 sm:w-64">
              <Search className="text-text-secondary size-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">Search indexed documents</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter documents"
                aria-label="Search indexed documents"
                className="w-full min-w-0 bg-transparent text-sm outline-none"
              />
            </label>
          </div>
          {filesLoading ? (
            <p role="status" className="text-text-secondary p-6 text-sm">Loading indexed documents…</p>
          ) : filesError ? (
            <div role="alert" className="flex items-center gap-3 p-5">
              <p className="text-text-secondary text-sm">Could not load your file inventory.</p>
              <button type="button" onClick={() => void refetchFiles()} className="rounded-lg border px-3 py-2 text-sm">Retry</button>
            </div>
          ) : visibleFiles.length === 0 ? (
            <p className="text-text-secondary p-5 text-sm">
              {search ? 'No documents match your search.' : 'No indexed documents yet. Upload through Agent File Search first.'}
            </p>
          ) : (
            <ul className="divide-border-light divide-y">
              {visibleFiles.map((file, index) => (
                <li key={file.file_id ?? index} className="flex min-w-0 items-center gap-3 px-4 py-3">
                  <FileText className="text-text-secondary size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm" title={file.filename}>{file.filename || 'Untitled document'}</span>
                  {selected && file.file_id ? (
                    <button
                      type="button"
                      disabled={pending || linkedIds.has(file.file_id)}
                      onClick={() => void addFile(file.file_id)}
                      className="text-text-secondary inline-flex shrink-0 items-center gap-1 text-xs disabled:opacity-50"
                    >
                      {linkedIds.has(file.file_id) ? 'Linked' : <><FilePlus2 className="size-4" aria-hidden="true" /> Add</>}
                    </button>
                  ) : (
                    <span className="text-text-secondary shrink-0 text-xs">Indexed</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2" aria-label="Knowledge workflows">
          <div className="border-border-light rounded-xl border p-4">
            <ShieldCheck className="mb-3 size-5" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Add new documents</h2>
            <p className="text-text-secondary mt-2 text-sm leading-6">
              Upload via existing Agent File Search. Then return here to link the indexed document to your KB.
            </p>
            <button type="button" onClick={openAgentBuilder} className="mt-3 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4">
              Open Agent Builder <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="border-border-light rounded-xl border p-4">
            <Link2 className="text-text-secondary mb-3 size-5" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Agent KB access — upcoming</h2>
            <p className="text-text-secondary mt-2 text-sm leading-6">
              Chat/Agent access, KB tags, uploads inside this page, and connected sources
              require separate authorization and retrieval wiring. None are enabled yet.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
