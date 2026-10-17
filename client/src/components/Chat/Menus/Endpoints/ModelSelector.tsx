import React, { useMemo } from 'react';
import { ChevronDown, GitCompareArrows, X } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { EModelEndpoint, getConfigDefaults } from 'librechat-data-provider';
import type { ModelSelectorProps } from '~/common';
import {
  renderModelSpecs,
  renderEndpoints,
  renderSearchResults,
  renderCustomGroups,
} from './components';
import { ModelSelectorProvider, useModelSelectorContext } from './ModelSelectorContext';
import { useShortcutAriaKey, useShortcutHint } from '~/hooks/useKeyboardShortcuts';
import { ModelSelectorChatProvider } from './ModelSelectorChatContext';
import { getSelectedIcon, getDisplayValue } from './utils';
import { CustomMenu as Menu } from './CustomMenu';
import DialogManager from './DialogManager';
import { useLocalize } from '~/hooks';

const defaultInterface = getConfigDefaults().interface;

function ModelSelectorContent() {
  const localize = useLocalize();
  const modelSelectorHint = useShortcutHint('openModelSelector', localize('com_ui_select_model'));
  const modelSelectorAriaKey = useShortcutAriaKey('openModelSelector');

  const {
    // LibreChat
    agentsMap,
    modelSpecs,
    mappedEndpoints,
    endpointsConfig,
    // State
    searchValue,
    searchResults,
    selectedValues,
    // Functions
    setSearchValue,
    setSelectedValues,
    // Dialog
    keyDialogOpen,
    onOpenChange,
    keyDialogEndpoint,
    compareMode,
    compareAllowed,
    comparison,
    setCompareMode,
    clearComparison,
  } = useModelSelectorContext();

  const selectedIcon = useMemo(
    () =>
      getSelectedIcon({
        mappedEndpoints: mappedEndpoints ?? [],
        selectedValues,
        modelSpecs,
        endpointsConfig,
        agentsMap,
      }),
    [mappedEndpoints, selectedValues, modelSpecs, endpointsConfig, agentsMap],
  );
  const selectedDisplayValue = useMemo(
    () =>
      getDisplayValue({
        localize,
        agentsMap,
        modelSpecs,
        selectedValues,
        mappedEndpoints,
      }),
    [localize, agentsMap, modelSpecs, selectedValues, mappedEndpoints],
  );

  // A model catalog isn't the same as an enabled chat endpoint. Do not offer
  // unconfigured providers as working models: direct users to the server setup.
  const onlyAgentsAvailable =
    (mappedEndpoints?.length ?? 0) === 1 &&
    mappedEndpoints?.[0]?.value === EModelEndpoint.agents &&
    modelSpecs.length === 0;

  const trigger = (
    <TooltipAnchor
      aria-label={localize('com_ui_select_model')}
      description={modelSelectorHint}
      render={
        <button
          data-testid="model-selector-button"
          aria-keyshortcuts={modelSelectorAriaKey}
          className="border-border-chrome bg-presentation text-text-primary hover:bg-surface-active-alt rounded-theme-control my-1 flex h-9 max-w-full items-center gap-2 border px-3 py-2 text-sm"
          aria-label={localize('com_ui_select_model')}
        >
          {selectedIcon && React.isValidElement(selectedIcon) && (
            <div className="flex shrink-0 items-center justify-center overflow-hidden">
              {selectedIcon}
            </div>
          )}
          <span className="truncate text-left">{selectedDisplayValue}</span>
          <ChevronDown
            size={14}
            className="text-text-secondary ml-0.5 shrink-0"
            aria-hidden="true"
          />
        </button>
      }
    />
  );

  return (
    <div className="relative flex min-w-0 max-w-[80vw] items-center gap-2 sm:max-w-xl">
      <Menu
        values={selectedValues}
        onValuesChange={(values: Record<string, any>) => {
          setSelectedValues({
            endpoint: values.endpoint || '',
            model: values.model || '',
            modelSpec: values.modelSpec || '',
          });
        }}
        onSearch={(value) => setSearchValue(value)}
        combobox={<input id="model-search" placeholder=" " />}
        comboboxLabel={localize('com_endpoint_search_models')}
        trigger={trigger}
      >
        <div className="border-border-light flex items-center justify-between gap-3 border-b px-3 py-2">
          <div className="min-w-0">
            <div className="text-text-primary text-xs font-semibold">MINE Model Selector</div>
            <div className="text-text-secondary text-xs">
              {compareMode ? 'Choose a second model (2 max)' : 'Choose your main model'}
            </div>
          </div>
          {compareAllowed && (
            <button
              type="button"
              aria-pressed={compareMode}
              onClick={() => setCompareMode(!compareMode)}
              className="border-border-light hover:bg-surface-hover text-text-primary flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-xs"
            >
              <GitCompareArrows className="size-3.5" aria-hidden="true" />
              {compareMode ? 'Done' : 'Compare +'}
            </button>
          )}
        </div>
        {comparison?.model && (
          <div className="border-border-light text-text-secondary flex items-center justify-between gap-2 border-b px-3 py-2 text-xs">
            <span className="truncate">
              Comparing with {comparison.model}
            </span>
            <button
              type="button"
              className="hover:bg-surface-hover rounded p-1"
              aria-label="Remove comparison model"
              onClick={clearComparison}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
        {searchResults ? (
          renderSearchResults(searchResults, localize, searchValue)
        ) : (
          <>
            {/* Render ungrouped modelSpecs (no group field) */}
            {renderModelSpecs(
              modelSpecs?.filter((spec) => !spec.group) || [],
              selectedValues.modelSpec || '',
            )}
            {/* Render endpoints (will include grouped specs matching endpoint names) */}
            {renderEndpoints(mappedEndpoints ?? [])}
            {/* Render custom groups (specs with group field not matching any endpoint) */}
            {renderCustomGroups(modelSpecs || [], mappedEndpoints ?? [])}
            {onlyAgentsAvailable && (
              <div
                role="status"
                className="text-text-secondary border-border-light border-t px-3 py-3 text-xs"
              >
                No chat providers are enabled yet. Connect OpenAI, Anthropic, or Google
                through the MINE BYOK server setup, then reload this menu.
              </div>
            )}
          </>
        )}
      </Menu>
      {comparison?.model && (
        <div className="border-border-chrome bg-presentation text-text-primary flex h-9 min-w-0 max-w-36 items-center gap-1 rounded-theme-control border px-2 text-xs">
          <GitCompareArrows className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate" title={comparison.model}>{comparison.model}</span>
          <button
            type="button"
            className="hover:bg-surface-hover shrink-0 rounded p-0.5"
            aria-label="Remove comparison model"
            onClick={clearComparison}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
      <DialogManager
        keyDialogOpen={keyDialogOpen}
        onOpenChange={onOpenChange}
        endpointsConfig={endpointsConfig || {}}
        keyDialogEndpoint={keyDialogEndpoint || undefined}
      />
    </div>
  );
}

export default function ModelSelector({ startupConfig }: ModelSelectorProps) {
  const interfaceConfig = startupConfig?.interface ?? defaultInterface;
  const modelSpecs = startupConfig?.modelSpecs?.list ?? [];

  // Hide the selector when modelSelect is false and there are no model specs to show
  if (interfaceConfig.modelSelect === false && modelSpecs.length === 0) {
    return null;
  }

  return (
    <ModelSelectorChatProvider>
      <ModelSelectorProvider startupConfig={startupConfig}>
        <ModelSelectorContent />
      </ModelSelectorProvider>
    </ModelSelectorChatProvider>
  );
}
