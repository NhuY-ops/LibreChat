import { atom } from 'jotai';

/**
 * Marketplace -> unsaved Agent Builder handoff.
 *
 * Chat routing can normalize /c/new URLs and strip arbitrary query parameters
 * before the Builder reads them. Keep the selected blueprint id in the current
 * browser tab's in-memory state rather than assuming location.search survives.
 *
 * Never store API credentials, draft contents or Agent resources here.
 * This only carries the immutable id of a built-in template and is consumed
 * when the user explicitly applies it in the new-Agent editor.
 */
export const mineTemplateHandoffAtom = atom<string | null>(null);
