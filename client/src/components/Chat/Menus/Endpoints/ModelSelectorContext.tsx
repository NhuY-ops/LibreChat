import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { useAtom } from 'jotai';
import debounce from 'lodash/debounce';
import {
  EModelEndpoint,
  PermissionBits,
  PermissionTypes,
  Permissions,
  isAgentsEndpoint,
  isAssistantsEndpoint,
} from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import type { Endpoint, SelectedValues } from '~/common';
import {
  useAgentDefaultPermissionLevel,
  useSelectorEffects,
  useKeyDialog,
  useEndpoints,
  useLocalize,
  useHasAccess,
} from '~/hooks';
import { useAgentsMapContext, useAssistantsMapContext, useLiveAnnouncer } from '~/Providers';
import { useGetEndpointsQuery, useListAgentsQuery } from '~/data-provider';
import { useModelSelectorChatContext } from './ModelSelectorChatContext';
import useSelectMention from '~/hooks/Input/useSelectMention';
import { filterItems } from './utils';
import store from '~/store';
import {
  MAX_MINE_SELECTED_MODELS,
  mineExtraModelsAtom,
  sameMineModel,
} from './mineSelection';
import type { MineModelChoice } from './mineSelection';

type ModelSelectorContextType = {
  // State
  searchValue: string;
  selectedValues: SelectedValues;
  endpointSearchValues: Record<string, string>;
  searchResults: (t.TModelSpec | Endpoint)[] | null;
  // LibreChat
  modelSpecs: t.TModelSpec[];
  mappedEndpoints: Endpoint[];
  agentsMap: t.TAgentsMap | undefined;
  assistantsMap: t.TAssistantsMap | undefined;
  endpointsConfig: t.TEndpointsConfig;

  // Functions
  endpointRequiresUserKey: (endpoint: string) => boolean;
  setSelectedValues: React.Dispatch<React.SetStateAction<SelectedValues>>;
  setSearchValue: (value: string) => void;
  setEndpointSearchValue: (endpoint: string, value: string) => void;
  handleSelectSpec: (spec: t.TModelSpec) => void;
  handleSelectEndpoint: (endpoint: Endpoint) => void;
  handleSelectModel: (endpoint: Endpoint, model: string) => void;
  compareMode: boolean;
  compareAllowed: boolean;
  setCompareMode: (enabled: boolean) => void;
  comparison: t.TConversation | null;
  extraModels: MineModelChoice[];
  isComparedModel: (endpoint: string, model: string) => boolean;
  toggleComparedModel: (endpoint: Endpoint, model: string) => void;
  clearComparison: () => void;
} & ReturnType<typeof useKeyDialog>;

const ModelSelectorContext = createContext<ModelSelectorContextType | undefined>(undefined);

export function useModelSelectorContext() {
  const context = useContext(ModelSelectorContext);
  if (context === undefined) {
    throw new Error('useModelSelectorContext must be used within a ModelSelectorProvider');
  }
  return context;
}

interface ModelSelectorProviderProps {
  children: React.ReactNode;
  startupConfig: t.TStartupConfig | undefined;
}

export function ModelSelectorProvider({ children, startupConfig }: ModelSelectorProviderProps) {
  const agentsMap = useAgentsMapContext();
  const assistantsMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { endpoint, model, spec, agent_id, assistant_id, getConversation, newConversation } =
    useModelSelectorChatContext();
  const localize = useLocalize();
  const { announcePolite } = useLiveAnnouncer();
  const [comparison, setComparison] = useRecoilState(store.conversationByIndex(1));
  const [extraModels, setExtraModels] = useAtom(mineExtraModelsAtom);
  const [compareMode, setCompareMode] = useState(false);
  const canCompare = useHasAccess({
    permissionType: PermissionTypes.MULTI_CONVO,
    permission: Permissions.USE,
  });
  const modelSpecs = useMemo(() => {
    /** Labels are normalized at the startup-config query boundary. */
    const specs = startupConfig?.modelSpecs?.list ?? [];
    if (!agentsMap) {
      return specs;
    }

    /**
     * Filter modelSpecs to only include agents the user has access to.
     * Use agentsMap which already contains permission-filtered agents (consistent with other components).
     */
    return specs.filter((spec) => {
      if (spec.preset?.endpoint === EModelEndpoint.agents && spec.preset?.agent_id) {
        return spec.preset.agent_id in agentsMap;
      }
      /** Keep non-agent modelSpecs */
      return true;
    });
  }, [startupConfig, agentsMap]);

  const permissionLevel = useAgentDefaultPermissionLevel();
  /**
   * Always query the VIEW scope so this shares one cache entry (and one paginated walk)
   * with `useAgentsMap` and `useMentions`. Asking for EDIT here spawned a second full
   * fetch under its own key, holding a duplicate copy of the whole agent list. The
   * marketplace's "my agents" framing is preserved by filtering on `isEditable`, which
   * the list endpoint resolves from the same ACL read it already performs.
   */
  const wantsEditableOnly = permissionLevel === PermissionBits.EDIT;
  const selectAgents = useCallback(
    (data: t.AgentListResponse) => {
      const list = data?.data;
      if (!wantsEditableOnly) {
        return list;
      }
      return list?.filter((agent) => agent.isEditable !== false);
    },
    [wantsEditableOnly],
  );
  const { data: agents = null } = useListAgentsQuery(
    { requiredPermission: PermissionBits.VIEW },
    { select: selectAgents },
  );

  const { mappedEndpoints, endpointRequiresUserKey } = useEndpoints({
    agents,
    assistantsMap,
    startupConfig,
    endpointsConfig,
  });

  const getModelDisplayName = useCallback(
    (endpoint: Endpoint, model: string): string => {
      if (isAgentsEndpoint(endpoint.value)) {
        return endpoint.agentNames?.[model] ?? agentsMap?.[model]?.name ?? model;
      }

      if (isAssistantsEndpoint(endpoint.value)) {
        return endpoint.assistantNames?.[model] ?? model;
      }

      return model;
    },
    [agentsMap],
  );

  const { onSelectEndpoint, onSelectSpec } = useSelectMention({
    // presets,
    modelSpecs,
    getConversation,
    assistantsMap,
    endpointsConfig,
    newConversation,
    returnHandlers: true,
  });

  // State
  const [selectedValues, setSelectedValues] = useState<SelectedValues>(() => {
    let initialModel = model || '';
    if (isAgentsEndpoint(endpoint) && agent_id) {
      initialModel = agent_id;
    } else if (isAssistantsEndpoint(endpoint) && assistant_id) {
      initialModel = assistant_id;
    }
    return {
      endpoint: endpoint || '',
      model: initialModel,
      modelSpec: spec || '',
    };
  });
  useSelectorEffects({
    agentsMap,
    conversation: endpoint
      ? ({
          endpoint: endpoint ?? null,
          model: model ?? null,
          spec: spec ?? null,
          agent_id: agent_id ?? null,
          assistant_id: assistant_id ?? null,
        } as any)
      : null,
    assistantsMap,
    setSelectedValues,
  });

  const [searchValue, setSearchValueState] = useState('');
  const [endpointSearchValues, setEndpointSearchValues] = useState<Record<string, string>>({});

  const keyProps = useKeyDialog();

  /** Memoized search results */
  const searchResults = useMemo(() => {
    if (!searchValue) {
      return null;
    }
    const allItems = [...modelSpecs, ...mappedEndpoints];
    return filterItems(allItems, searchValue, agentsMap, assistantsMap || {}, localize);
  }, [searchValue, modelSpecs, mappedEndpoints, agentsMap, assistantsMap, localize]);

  const setDebouncedSearchValue = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValueState(value);
      }, 200),
    [],
  );
  const setEndpointSearchValue = useCallback((endpoint: string, value: string) => {
    setEndpointSearchValues((prev) => ({
      ...prev,
      [endpoint]: value,
    }));
  }, []);

  // MINE stores up to ${MAX_MINE_SELECTED_MODELS} chosen models, without
  // pretending LibreChat's current two-pane send can run all of them.
  // The first additional model is bound to the real compare conversation.
  const isComparedModel = useCallback(
    (ep: string, selectedModel: string) =>
      (comparison?.endpoint === ep && comparison?.model === selectedModel) ||
      extraModels.some((item) => item.endpoint === ep && item.model === selectedModel),
    [comparison?.endpoint, comparison?.model, extraModels],
  );

  const clearComparison = useCallback(() => {
    const next = extraModels[0];
    if (!next || !comparison) {
      setComparison(null);
      return;
    }
    setComparison({
      ...comparison,
      endpoint: next.endpoint as t.EModelEndpoint,
      endpointType: undefined,
      model: next.model,
      spec: undefined,
      agent_id: undefined,
      assistant_id: undefined,
    });
    setExtraModels(extraModels.slice(1));
  }, [comparison, extraModels, setComparison, setExtraModels]);

  const toggleComparedModel = useCallback(
    (chosenEndpoint: Endpoint, chosenModel: string) => {
      if (
        canCompare !== true ||
        !endpoint ||
        !model ||
        isAssistantsEndpoint(endpoint) ||
        !chosenEndpoint.value ||
        !chosenModel ||
        isAgentsEndpoint(chosenEndpoint.value) ||
        isAssistantsEndpoint(chosenEndpoint.value)
      ) {
        return;
      }
      const choice: MineModelChoice = { endpoint: chosenEndpoint.value, model: chosenModel };
      if (sameMineModel(choice, { endpoint, model })) {
        return;
      }
      if (comparison?.endpoint === choice.endpoint && comparison?.model === choice.model) {
        clearComparison();
        return;
      }
      if (extraModels.some((item) => sameMineModel(item, choice))) {
        setExtraModels((current) => current.filter((item) => !sameMineModel(item, choice)));
        return;
      }
      if (1 + Number(Boolean(comparison?.model)) + extraModels.length >= MAX_MINE_SELECTED_MODELS) {
        announcePolite({ message: 'MINE allows up to 8 selected models.', isStatus: true });
        return;
      }
      if (comparison) {
        setExtraModels((current) => [...current, choice]);
        return;
      }
      const base = getConversation();
      if (!base) {
        return;
      }
      setComparison({
        ...base,
        title: '',
        endpoint: choice.endpoint as t.EModelEndpoint,
        endpointType: undefined,
        model: choice.model,
        spec: undefined,
        agent_id: undefined,
        assistant_id: undefined,
      });
    },
    [
      canCompare,
      endpoint,
      model,
      comparison,
      extraModels,
      clearComparison,
      announcePolite,
      getConversation,
      setComparison,
      setExtraModels,
    ],
  );

  const handleSelectSpec = useCallback(
    (spec: t.TModelSpec) => {
      let model = spec.preset.model ?? null;
      onSelectSpec?.(spec);
      /** Specs arrive with `preset.endpoint` materialized at config load. */
      const endpoint = spec.preset.endpoint ?? null;
      if (isAgentsEndpoint(endpoint)) {
        model = spec.preset.agent_id ?? '';
      } else if (isAssistantsEndpoint(endpoint)) {
        model = spec.preset.assistant_id ?? '';
      }
      setSelectedValues({
        endpoint,
        model,
        modelSpec: spec.name,
      });
    },
    [onSelectSpec],
  );

  const handleSelectEndpoint = useCallback(
    (endpoint: Endpoint) => {
      if (!endpoint.hasModels) {
        if (endpoint.value) {
          onSelectEndpoint?.(endpoint.value);
        }
        setSelectedValues({
          endpoint: endpoint.value,
          model: '',
          modelSpec: '',
        });
      }
    },
    [onSelectEndpoint],
  );

  const handleSelectModel = useCallback(
    (endpoint: Endpoint, model: string) => {
      if (isAgentsEndpoint(endpoint.value)) {
        onSelectEndpoint?.(endpoint.value, {
          agent_id: model,
          model: agentsMap?.[model]?.model ?? '',
        });
      } else if (isAssistantsEndpoint(endpoint.value)) {
        onSelectEndpoint?.(endpoint.value, {
          assistant_id: model,
          model: assistantsMap?.[endpoint.value]?.[model]?.model ?? '',
        });
      } else if (endpoint.value) {
        onSelectEndpoint?.(endpoint.value, { model });
      }
      setSelectedValues({
        endpoint: endpoint.value,
        model,
        modelSpec: '',
      });

      const modelDisplayName = getModelDisplayName(endpoint, model);
      const announcement = localize('com_ui_model_selected', { 0: modelDisplayName });
      announcePolite({ message: announcement, isStatus: true });
    },
    [agentsMap, announcePolite, assistantsMap, getModelDisplayName, localize, onSelectEndpoint],
  );

  const compareAllowed =
    canCompare === true && !!endpoint && !!model && !isAssistantsEndpoint(endpoint);

  const value = useMemo(
    () => ({
      searchValue,
      searchResults,
      selectedValues,
      endpointSearchValues,
      agentsMap,
      modelSpecs,
      assistantsMap,
      mappedEndpoints,
      endpointsConfig,
      handleSelectSpec,
      handleSelectModel,
      compareMode,
      compareAllowed,
      setCompareMode,
      comparison: comparison ?? null,
      extraModels,
      isComparedModel,
      toggleComparedModel,
      clearComparison,
      setSelectedValues,
      handleSelectEndpoint,
      setEndpointSearchValue,
      endpointRequiresUserKey,
      setSearchValue: setDebouncedSearchValue,
      ...keyProps,
    }),
    [
      searchValue,
      searchResults,
      selectedValues,
      endpointSearchValues,
      agentsMap,
      modelSpecs,
      assistantsMap,
      mappedEndpoints,
      endpointsConfig,
      handleSelectSpec,
      handleSelectModel,
      compareMode,
      compareAllowed,
      comparison,
      extraModels,
      isComparedModel,
      toggleComparedModel,
      clearComparison,
      setSelectedValues,
      handleSelectEndpoint,
      setEndpointSearchValue,
      endpointRequiresUserKey,
      setDebouncedSearchValue,
      keyProps,
    ],
  );

  return <ModelSelectorContext.Provider value={value}>{children}</ModelSelectorContext.Provider>;
}
