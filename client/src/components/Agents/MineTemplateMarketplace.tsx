import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Code2, GraduationCap, Megaphone, Sparkles, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MINE_AGENT_TEMPLATES } from '~/components/SidePanel/Agents/mineAgentTemplates';

const ICONS: Record<string, LucideIcon> = {
  general: UserRound,
  research: BookOpen,
  marketing: Megaphone,
  coding: Code2,
  learning: GraduationCap,
};

/** Curated blueprints are not marketplace-published Agents.
 * Selecting one stages the editor draft; only the user's ordinary Create action
 * can persist it, and no model, tool, key or knowledge file is provisioned here.
 */
export default function MineTemplateMarketplace({ searchQuery = '' }: { searchQuery?: string }) {
  const navigate = useNavigate();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const templates = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return MINE_AGENT_TEMPLATES;
    return MINE_AGENT_TEMPLATES.filter((item) =>
      [item.title, item.name, item.description, item.categoryLabel].some((field) =>
        field.toLocaleLowerCase().includes(query),
      ),
    );
  }, [searchQuery]);

  const selected = templates.find((item) => item.id === previewId);

  return (
    <section aria-label="MINE Agent templates" className="mx-auto w-full max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-text-secondary flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="size-3.5" aria-hidden="true" /> MINE Agent Studio
          </span>
          <h2 className="text-text-primary mt-1 text-xl font-semibold">Agent Templates</h2>
          <p className="text-text-secondary mt-1 max-w-2xl text-sm">
            Start with a curated blueprint, then choose your own model and Tools.
            Templates are not published Agents and do not use API credits until you run them.
          </p>
        </div>
        <span className="text-text-secondary text-xs">{templates.length} templates</span>
      </div>
      {templates.length === 0 ? (
        <p role="status" className="text-text-secondary rounded-xl border border-border-light p-5 text-sm">
          No Agent templates match your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => {
            const Icon = ICONS[template.id] ?? Sparkles;
            return (
              <article key={template.id} className="border-border-light bg-surface-secondary flex flex-col rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="bg-surface-tertiary rounded-lg p-2.5">
                    <Icon className="text-text-primary size-5" aria-hidden="true" />
                  </div>
                  {template.id === 'research' && (
                    <span className="border-border-light text-text-secondary rounded-full border px-2 py-1 text-[11px]">V1</span>
                  )}
                </div>
                <h3 className="text-text-primary mt-3 text-base font-semibold">{template.name}</h3>
                <p className="text-text-secondary mt-1 text-xs">{template.categoryLabel}</p>
                <p className="text-text-secondary mt-2 flex-1 text-sm leading-5">{template.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/c/new?mineAgentTemplate=${encodeURIComponent(template.id)}`)}
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
              </article>
            );
          })}
        </div>
      )}
      {selected && (
        <div className="border-border-light bg-surface-secondary mt-4 rounded-xl border p-4" role="region" aria-label={`${selected.name} template details`}>
          <h3 className="text-text-primary font-semibold">{selected.name} — overview</h3>
          <p className="text-text-secondary mt-2 text-sm">{selected.description}</p>
          <p className="text-text-primary mt-3 text-xs font-semibold">Suggested conversation starters</p>
          <ul className="text-text-secondary mt-2 list-inside list-disc space-y-1 text-sm">
            {selected.starters.map((starter) => <li key={starter}>{starter}</li>)}
          </ul>
          <p className="text-text-secondary mt-3 text-xs">
            Tools require explicit permission and configuration. This preview does not publish or create an Agent.
          </p>
        </div>
      )}
    </section>
  );
}
