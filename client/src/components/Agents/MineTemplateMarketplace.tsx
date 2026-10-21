import { useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Film,
  GraduationCap,
  Image as ImageIcon,
  LayoutGrid,
  Megaphone,
  Mic,
  Palette,
  Plug,
  Sparkles,
  UserRound,
  WandSparkles,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EModelEndpoint } from 'librechat-data-provider';
import { activePanelAtom } from '~/Providers';
import { MINE_AGENT_TEMPLATES } from '~/components/SidePanel/Agents/mineAgentTemplates';
import type { MineAgentTemplate, MineCreativeCollection } from '~/components/SidePanel/Agents/mineAgentTemplates';

const ICONS: Record<string, LucideIcon> = {
  general: UserRound,
  research: BookOpen,
  marketing: Megaphone,
  coding: Code2,
  learning: GraduationCap,
};

const CREATIVE_ICONS: Record<MineCreativeCollection, LucideIcon> = {
  image: ImageIcon,
  video: Film,
  design: Palette,
  audio: Mic,
  content: FileText,
};

type CollectionFilter = 'all' | 'core' | 'creative' | MineCreativeCollection;

const FILTERS: readonly { id: CollectionFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'core', label: 'Essentials' },
  { id: 'creative', label: 'Creative Studios' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'design', label: 'Design' },
  { id: 'audio', label: 'Audio' },
  { id: 'content', label: 'Content' },
];

function matchesCollection(template: MineAgentTemplate, filter: CollectionFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'core':
      return !template.collection;
    case 'creative':
      return template.collection != null;
    default:
      return template.collection === filter;
  }
}

/**
 * Templates only populate an unsaved Agent draft: a configured model may help
 * plan creative assets immediately, but no image/video/audio file can be
 * produced without explicit compatible tool access. The gallery does not grant
 * tools, keys, data permissions or access to marketplace-published Agents.
 */
export default function MineTemplateMarketplace({ searchQuery = '' }: { searchQuery?: string }) {
  const navigate = useNavigate();
  const setActivePanel = useSetAtom(activePanelAtom);
  const [filter, setFilter] = useState<CollectionFilter>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const counts = useMemo(() => {
    const entries = FILTERS.map(({ id }) => [
      id,
      MINE_AGENT_TEMPLATES.filter((item) => matchesCollection(item, id)).length,
    ] as const);
    return new Map<CollectionFilter, number>(entries);
  }, []);

  const templates = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return MINE_AGENT_TEMPLATES.filter((item) => {
      if (!matchesCollection(item, filter)) return false;
      if (!query) return true;
      return [item.title, item.name, item.description, item.categoryLabel, item.collection ?? '']
        .some((field) => field.toLocaleLowerCase().includes(query));
    });
  }, [searchQuery, filter]);

  const selected = templates.find((item) => item.id === previewId);

  const configureTemplate = (template: MineAgentTemplate) => {
    // The destination is a new Agent draft, not the currently saved Agent.
    // Opening Builder automatically avoids requiring the user to discover the
    // sidebar tab after navigating away from Marketplace.
    setActivePanel(EModelEndpoint.agents);
    navigate(`/c/new?mineAgentTemplate=${encodeURIComponent(template.id)}`);
  };

  return (
    <section aria-label="MINE Agent templates" className="mx-auto w-full max-w-6xl">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-text-secondary flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="size-3.5" aria-hidden="true" /> MINE Agent Studio
          </span>
          <h2 className="text-text-primary mt-1 text-xl font-semibold">Agent Templates</h2>
          <p className="text-text-secondary mt-1 max-w-2xl text-sm">
            Pick a creative studio or a work assistant, customize its model and Tools, and create your own Agent.
          </p>
        </div>
        <span className="text-text-secondary text-xs">{MINE_AGENT_TEMPLATES.length} blueprints</span>
      </div>

      <div className="border-border-light bg-surface-secondary mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5">
        <WandSparkles className="text-text-secondary mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="text-text-secondary text-xs leading-5">
          <strong className="text-text-primary">Creative Agents are blueprints, not built-in media renderers.</strong>{' '}
          They can plan shots, prompts and scripts immediately. Finished images, videos, music and exported media need a connected compatible tool.
          Nothing is generated, published or charged when you browse templates.
        </p>
      </div>

      <div
        role="group"
        aria-label="Filter Agent templates by studio"
        className="mb-4 flex flex-wrap items-center gap-1.5"
      >
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => {
              setFilter(id);
              setPreviewId(null);
            }}
            className={`border-border-chrome inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-primary ${filter === id ? 'bg-surface-active-alt text-text-primary' : 'bg-surface-secondary text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
          >
            {id === 'all' && <LayoutGrid className="size-3" aria-hidden="true" />}
            {label} <span className="opacity-70">{counts.get(id)}</span>
          </button>
        ))}
      </div>

      <p role="status" className="text-text-secondary mb-3 text-xs">
        {templates.length} matching templates
      </p>

      {templates.length === 0 ? (
        <p className="text-text-secondary rounded-xl border border-border-light p-5 text-sm">
          No Agent templates match your search or filter. Try another keyword or select All.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => {
            const Icon = template.collection
              ? CREATIVE_ICONS[template.collection]
              : (ICONS[template.id] ?? Sparkles);
            return (
              <article
                key={template.id}
                data-testid={`mine-template-card-${template.id}`}
                className="border-border-light bg-surface-secondary flex min-w-0 flex-col rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="bg-surface-tertiary rounded-lg p-2.5">
                    <Icon className="text-text-primary size-5" aria-hidden="true" />
                  </div>
                  {template.id === 'research' ? (
                    <span className="border-border-light text-text-secondary rounded-full border px-2 py-1 text-[11px]">V1</span>
                  ) : template.requiredTool ? (
                    <span className="text-text-secondary inline-flex items-center gap-1 text-[11px]" title={template.requiredTool}>
                      <Plug className="size-3" aria-hidden="true" /> Tool needed
                    </span>
                  ) : template.collection ? (
                    <span className="text-text-secondary text-[11px]">Planning-ready</span>
                  ) : null}
                </div>
                <h3 className="text-text-primary mt-3 text-base font-semibold">{template.name}</h3>
                <p className="text-text-secondary mt-1 text-xs">{template.categoryLabel}</p>
                <p className="text-text-secondary mt-2 flex-1 text-sm leading-5">{template.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => configureTemplate(template)}
                    className="bg-surface-active-alt text-text-primary hover:bg-surface-hover inline-flex items-center gap-1.5 rounded-lg border border-border-light px-3 py-2 text-xs font-medium"
                    aria-label={`Configure ${template.name} template`}
                  >
                    Use template <ArrowRight className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="text-text-secondary hover:text-text-primary rounded-lg px-2 py-2 text-xs"
                    aria-expanded={selected?.id === template.id}
                    onClick={() => setPreviewId((id) => (id === template.id ? null : template.id))}
                  >
                    {selected?.id === template.id ? 'Hide details' : 'Preview'}
                  </button>
                </div>
                {selected?.id === template.id && (
                  <div
                    className="border-border-light bg-surface-primary mt-3 rounded-lg border p-3"
                    role="region"
                    aria-label={`${template.name} template details`}
                  >
                    <h4 className="text-text-primary text-sm font-semibold">{template.name} — overview</h4>
                    <p className="text-text-secondary mt-1 text-sm">{template.description}</p>
                    {template.workflow && (
                      <>
                        <p className="text-text-primary mt-3 text-xs font-semibold">Workflow</p>
                        <ol className="text-text-secondary mt-1 list-inside list-decimal space-y-1 text-xs">
                          {template.workflow.map((step) => <li key={step}>{step}</li>)}
                        </ol>
                      </>
                    )}
                    {template.requiredTool && (
                      <p className="text-text-secondary mt-3 flex items-start gap-1.5 text-xs" role="note">
                        <Plug className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        Real generated media requires a configured {template.requiredTool}; the template alone cannot render or export files.
                      </p>
                    )}
                    <p className="text-text-primary mt-3 text-xs font-semibold">Suggested conversation starters</p>
                    <ul className="text-text-secondary mt-1 list-inside list-disc space-y-1 text-xs">
                      {template.starters.map((starter) => <li key={starter}>{starter}</li>)}
                    </ul>
                    <p className="text-text-secondary mt-3 text-xs">
                      All Tools, provider keys and access permissions are optional and configured separately.
                      This preview does not create or publish an Agent.
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

    </section>
  );
}
