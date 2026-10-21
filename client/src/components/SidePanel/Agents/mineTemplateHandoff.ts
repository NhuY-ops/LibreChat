import { atom } from 'jotai';

/**
 * Marketplace -> unsaved Agent Builder handoff.
 *
 * Chat routing can normalize /c/new URLs and strip arbitrary query parameters
 * before the Builder reads them. Keep the selected blueprint id in the current
 * browser tab's in-memory state rather than assuming location.search survives.
 *
 * Never store API credentials, draft contents or Agent resources here.
 * The handoff is consumed after the builder initializes a new draft. The
 * Builder session remains set while that draft is being configured, to stop
 * the still-selected Chat Agent from hijacking the Agent Builder on re-render.
 */
export const mineTemplateHandoffAtom = atom<string | null>(null);

/** Keeps the new-Agent Builder independent of the previous Chat Agent. */
export const mineTemplateBuilderSessionAtom = atom<string | null>(null);
