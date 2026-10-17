import { useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import { Plus, X, GitCompareArrows } from 'lucide-react';
import type { EModelEndpoint, TConversation } from 'librechat-data-provider';
import type { SetterOrUpdater } from 'recoil';
import {
  MAX_MINE_SELECTED_MODELS,
  mineExtraModelsAtom,
  sameMineModel,
} from '~/components/Chat/Menus/Endpoints/mineSelection';

interface Props {
  conversation: TConversation | null;
  addedConvo: TConversation | null;
  setAddedConvo: SetterOrUpdater<TConversation | null>;
}

export default function MineSelectedModelsBar({
  conversation,
  addedConvo,
  setAddedConvo,
}: Props) {
  const [extraModels, setExtraModels] = useAtom(mineExtraModelsAtom);
  const main = useMemo(
    () => ({
      endpoint: conversation?.endpoint ?? '',
      model: conversation?.model ?? '',
    }),
    [conversation?.endpoint, conversation?.model],
  );

  const chosen = useMemo(() => {
    const models = [
      ...(main.endpoint && main.model ? [{ ...main, role: 'main' as const }] : []),
      ...(addedConvo?.endpoint && addedConvo?.model
        ? [{ endpoint: addedConvo.endpoint, model: addedConvo.model, role: 'compare' as const }]
        : []),
      ...extraModels.map((item) => ({ ...item, role: 'selected' as const })),
    ];
    // An external model switch can duplicate another selected chip.
    return models.filter(
      (item, index) =>
        models.findIndex((other) => sameMineModel(other, item)) === index,
    );
  }, [main, addedConvo?.endpoint, addedConvo?.model, extraModels]);

  const remove = useCallback(
    (endpoint: string, model: string) => {
      if (addedConvo?.endpoint === endpoint && addedConvo?.model === model) {
        const next = extraModels[0];
        if (!next) {
          setAddedConvo(null);
          return;
        }
        setAddedConvo({
          ...addedConvo,
          // LibreChat also represents custom provider ids (e.g. OpenRouter)
          // through the endpoint enum type when writing conversation state.
          endpoint: next.endpoint as EModelEndpoint,
          endpointType: undefined,
          model: next.model,
          spec: undefined,
          agent_id: undefined,
          assistant_id: undefined,
        });
        setExtraModels(extraModels.slice(1));
        return;
      }
      setExtraModels((current) =>
        current.filter((item) => !(item.endpoint === endpoint && item.model === model)),
      );
    },
    [addedConvo, extraModels, setAddedConvo, setExtraModels],
  );

  const openSelector = useCallback(() => {
    document.querySelector<HTMLButtonElement>('[data-testid="model-selector-button"]')?.click();
  }, []);

  if (!main.model && chosen.length === 0) {
    return null;
  }

  const activeCount = Number(Boolean(main.model)) + Number(Boolean(addedConvo?.model));
  const selectedOnlyCount = chosen.filter((item) => item.role === 'selected').length;

  return (
    <div
      className="border-border-light flex flex-col gap-2 border-b px-3 py-2"
      aria-label="Selected MINE models"
      data-testid="mine-selected-models-bar"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-text-secondary flex items-center gap-1.5 text-xs font-medium">
          <GitCompareArrows className="size-3.5" aria-hidden="true" />
          Models selected: {chosen.length}/{MAX_MINE_SELECTED_MODELS}
        </span>
        <button
          type="button"
          onClick={openSelector}
          className="text-text-secondary hover:text-text-primary hover:bg-surface-hover flex items-center gap-1 rounded-md px-2 py-1 text-xs"
          aria-label="Add more AI models"
        >
          <Plus className="size-3.5" aria-hidden="true" /> Add models
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label="Chosen models">
        {chosen.map((item) => (
          <span
            role="listitem"
            key={item.endpoint + ':' + item.model}
            className="border-border-light bg-surface-secondary-alt text-text-primary inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-xs"
            title={item.endpoint + ' / ' + item.model}
          >
            <span className="text-text-secondary max-w-20 truncate font-semibold">
              {item.endpoint}
            </span>
            <span className="max-w-40 truncate">{item.model}</span>
            <span className="text-text-secondary shrink-0 text-[10px]">
              {item.role === 'main'
                ? 'Main'
                : item.role === 'compare'
                  ? 'Live'
                  : 'Saved'}
            </span>
            {item.role !== 'main' && (
              <button
                type="button"
                onClick={() => remove(item.endpoint, item.model)}
                aria-label={'Remove ' + item.model}
                className="text-text-secondary hover:bg-surface-hover hover:text-text-primary rounded p-0.5"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
      </div>
      {selectedOnlyCount > 0 && (
        <p className="text-text-secondary text-xs" role="status">
          {activeCount} model(s) can receive this message. {selectedOnlyCount} additional
          model(s) are saved selections only — not sent yet. More parallel responses need
          the multi-run engine.
        </p>
      )}
    </div>
  );
}
