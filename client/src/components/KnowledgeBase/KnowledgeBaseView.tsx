import { useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { EModelEndpoint } from 'librechat-data-provider';
import type { TFile } from 'librechat-data-provider';
import { Database, FileText, FolderOpen, Search, ArrowRight, RefreshCw, Link2, ShieldCheck } from 'lucide-react';
import { useGetFiles } from '~/data-provider';
import { activePanelAtom } from '~/Providers';
import { showFilesDialogAtom } from '~/store/filesDialog';
import { filterIndexedFiles } from './knowledgeFiles';

/**
 * Phase 1: truthful, working view of the current user-scoped RAG file inventory.
 * No artificial KB collections, permissions or connectors are persisted here.
 * The existing Agent File Search and My Files flows remain the authority.
 */
export default function KnowledgeBaseView() {
  const navigate = useNavigate();
  const setActivePanel = useSetAtom(activePanelAtom);
  const setFilesOpen = useSetAtom(showFilesDialogAtom);
  const [search, setSearch] = useState('');
  const { data: files = [], isLoading, isError, refetch } = useGetFiles<TFile[]>();

  const indexedFiles = useMemo(() => filterIndexedFiles(files), [files]);
  const visibleFiles = useMemo(() => filterIndexedFiles(files, search), [files, search]);
  const pendingCount = files.filter((file) => file.embedded !== true).length;

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
              Browse documents already indexed by MINE's existing RAG service.
              Use Agent File Search to add knowledge for an Agent. Standalone KB
              collections and source connections are not enabled yet.
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

        <section aria-label="Knowledge file status" className="grid gap-3 sm:grid-cols-2">
          <div className="border-border-light rounded-xl border p-4">
            <p className="text-text-secondary text-sm">Indexed for retrieval</p>
            <p className="mt-2 text-2xl font-semibold" data-testid="kb-indexed-count">
              {isLoading ? '—' : indexedFiles.length}
            </p>
            <p className="text-text-secondary mt-1 text-xs">Documents marked embedded by RAG</p>
          </div>
          <div className="border-border-light rounded-xl border p-4">
            <p className="text-text-secondary text-sm">Other uploaded files</p>
            <p className="mt-2 text-2xl font-semibold">
              {isLoading ? '—' : pendingCount}
            </p>
            <p className="text-text-secondary mt-1 text-xs">
              Not marked indexed; some may be attachments or media
            </p>
          </div>
        </section>

        <section aria-label="Indexed documents" className="border-border-light overflow-hidden rounded-xl border">
          <div className="border-border-light flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <h2 className="text-base font-semibold">Indexed documents</h2>
              <p className="text-text-secondary mt-1 text-xs">
                Existing user-owned files only; not a shared collection or tag-based KB
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
          {isLoading ? (
            <p role="status" className="text-text-secondary p-6 text-sm">Loading your files…</p>
          ) : isError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-6">
              <p className="text-text-secondary text-sm">Could not load your file inventory.</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="border-border-light inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <RefreshCw className="size-4" aria-hidden="true" /> Retry
              </button>
            </div>
          ) : visibleFiles.length === 0 ? (
            <div className="flex flex-col items-start gap-3 p-6">
              <FileText className="text-text-secondary size-6" aria-hidden="true" />
              <p className="text-sm font-medium">
                {search ? 'No indexed documents match your search.' : 'No indexed documents yet.'}
              </p>
              {!search && (
                <p className="text-text-secondary text-sm">
                  To index a document today, create or open an Agent and upload it through File Search.
                  Your existing files and RAG configuration stay unchanged.
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-border-light divide-y">
              {visibleFiles.map((file, index) => (
                <li key={file.file_id ?? index} className="flex min-w-0 items-center gap-3 px-4 py-3">
                  <FileText className="text-text-secondary size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm" title={file.filename}>
                    {file.filename || 'Untitled document'}
                  </span>
                  <span className="text-text-secondary shrink-0 text-xs">Indexed</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Knowledge workflows" className="grid gap-3 sm:grid-cols-2">
          <div className="border-border-light rounded-xl border p-4">
            <ShieldCheck className="mb-3 size-5" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Add knowledge to an Agent</h2>
            <p className="text-text-secondary mt-2 text-sm leading-6">
              Upload via the existing File Search control and save your Agent.
              Retrieval permissions remain managed by the current backend.
            </p>
            <button
              type="button"
              onClick={openAgentBuilder}
              className="mt-3 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
            >
              Open Agent Builder <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="border-border-light rounded-xl border p-4">
            <Link2 className="text-text-secondary mb-3 size-5" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Connected knowledge — next phase</h2>
            <p className="text-text-secondary mt-2 text-sm leading-6">
              Named KB collections, tags, per-Agent KB access, and Google Drive,
              Notion, GitHub and website sync require a separate authorized backend.
              They are not active in this version.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
