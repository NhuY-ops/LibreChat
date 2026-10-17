import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Code2,
  Compass,
  FileText,
  FolderOpen,
  Lightbulb,
  ListTodo,
  MessageSquare,
  Monitor,
  Presentation,
  Search,
  Sparkles,
  Table2,
  WandSparkles,
  Workflow,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  MINE_CAPABILITIES,
  MINE_CATEGORIES,
} from './capabilities';
import type { MineCapability, MineCapabilityCategory } from './capabilities';

const icons: Record<string, LucideIcon> = {
  chat: MessageSquare,
  search: Search,
  projects: FolderOpen,
  agents: Bot,
  skills: Sparkles,
  contextual: WandSparkles,
  outcomes: ListTodo,
  documents: FileText,
  sheets: Table2,
  slides: Presentation,
  mini: Monitor,
  code: Code2,
};

type CategoryFilter = 'All features' | MineCapabilityCategory;
const categoryFilters: CategoryFilter[] = ['All features', ...MINE_CATEGORIES];

function CapabilityCard({ capability }: { capability: MineCapability }) {
  const Icon = icons[capability.id] ?? Lightbulb;
  const available = capability.status === 'available' && capability.path != null;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="bg-surface-tertiary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <Icon className="text-text-primary size-5" aria-hidden="true" />
        </div>
        <span
          className={
            available
              ? 'text-text-secondary rounded-md border border-border-light px-2 py-1 text-xs'
              : 'text-text-tertiary rounded-md border border-border-light px-2 py-1 text-xs'
          }
        >
          {available ? 'Available' : 'Coming soon'}
        </span>
      </div>
      <div className="mt-4 space-y-1.5">
        <h2 className="text-text-primary text-base font-semibold">{capability.name}</h2>
        <p className="text-text-secondary text-sm leading-5">{capability.description}</p>
      </div>
      {capability.requirements && (
        <p className="text-text-tertiary mt-3 text-xs leading-5">{capability.requirements}</p>
      )}
      {available && (
        <span className="text-text-primary mt-auto flex items-center gap-1.5 pt-4 text-sm font-medium">
          Open feature
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      )}
    </>
  );
  const styles =
    'border-border-light bg-surface-secondary relative flex min-h-48 flex-col rounded-2xl border p-4 text-left';
  if (!available) {
    return (
      <article className={styles} data-capability-status="planned">
        {body}
      </article>
    );
  }
  return (
    <Link
      to={capability.path!}
      className={styles + ' hover:bg-surface-hover focus-visible:ring-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2'}
      data-capability-status="available"
      aria-label={'Open ' + capability.name}
    >
      {body}
    </Link>
  );
}

/** Discoverable counterpart to MINE's future contextual tool suggestions.
 * This screen never attempts execution; available entries navigate to real routes.
 */
export default function ExploreFeatures() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All features');
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return MINE_CAPABILITIES.filter((item) => {
      if (category !== 'All features' && item.category !== category) {
        return false;
      }
      return (
        !text ||
        [item.name, item.description, item.category, item.requirements ?? ''].some((value) =>
          value.toLowerCase().includes(text),
        )
      );
    });
  }, [query, category]);

  return (
    <main className="bg-surface-canvas text-text-primary h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 pt-10 sm:px-10">
        <div className="mb-6 flex items-center gap-2 text-sm font-medium">
          <Compass className="size-4" aria-hidden="true" />
          MINE / Explore
        </div>
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Explore everything MINE can do.
          </h1>
          <p className="text-text-secondary mt-3 text-base leading-7">
            Start with a chat, or find a capability directly. MINE keeps all tools
            discoverable, even when contextual suggestions have not appeared yet.
          </p>
        </div>

        <div className="border-border-light bg-surface-secondary mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
          <div className="flex min-w-0 items-center gap-3">
            <WandSparkles className="text-text-secondary size-5 shrink-0" aria-hidden="true" />
            <p className="text-text-secondary text-sm">
              Not sure which tool to use? Describe your goal and start in Chat.
            </p>
          </div>
          <Link
            to="/c/new"
            className="bg-surface-submit text-text-primary flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90"
          >
            Open Chat <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-8 max-w-xl">
          <label htmlFor="mine-explore-search" className="text-text-primary mb-2 block text-sm font-medium">
            Search features
          </label>
          <div className="border-border-light bg-surface-secondary flex items-center gap-2 rounded-xl border px-3">
            <Search className="text-text-secondary size-4 shrink-0" aria-hidden="true" />
            <input
              id="mine-explore-search"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try Projects, Agents, Sheets..."
              className="text-text-primary placeholder:text-text-tertiary min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-text-secondary hover:text-text-primary rounded p-1"
                aria-label="Clear feature search"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" aria-label="Feature categories">
          {categoryFilters.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              className={
                category === item
                  ? 'bg-surface-active text-text-primary border-border-medium rounded-full border px-3 py-1.5 text-sm font-medium'
                  : 'bg-surface-secondary text-text-secondary hover:bg-surface-hover border-border-light rounded-full border px-3 py-1.5 text-sm'
              }
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-2">
          <p className="text-text-secondary text-sm" role="status" aria-live="polite">
            {filtered.length} feature{filtered.length === 1 ? '' : 's'} found
          </p>
          <p className="text-text-tertiary text-xs">
            Available = feature page exists; access may require setup or permission.
          </p>
        </div>
        {filtered.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((capability) => (
              <CapabilityCard key={capability.id} capability={capability} />
            ))}
          </div>
        ) : (
          <div className="border-border-light mt-3 rounded-xl border p-8 text-center">
            <p className="text-text-primary font-medium">No matching features</p>
            <p className="text-text-secondary mt-1 text-sm">
              Try a different search or switch to All features.
            </p>
            <button
              type="button"
              className="text-text-primary mt-3 inline-flex items-center gap-2 underline underline-offset-4"
              onClick={() => {
                setQuery('');
                setCategory('All features');
              }}
            >
              <X className="size-4" aria-hidden="true" /> Clear filters
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
