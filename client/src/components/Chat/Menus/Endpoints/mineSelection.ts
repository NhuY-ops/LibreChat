import { atom } from 'jotai';

/** Extra MINE model choices beyond LibreChat's two active response panes.
 * Selection is kept in memory only and does not store API credentials.
 */
export type MineModelChoice = {
  endpoint: string;
  model: string;
};

export const MAX_MINE_SELECTED_MODELS = 8;

export const mineExtraModelsAtom = atom<MineModelChoice[]>([]);

export const sameMineModel = (a: MineModelChoice, b: MineModelChoice) =>
  a.endpoint === b.endpoint && a.model === b.model;
