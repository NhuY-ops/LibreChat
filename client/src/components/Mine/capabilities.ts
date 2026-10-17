/**
 * Single source of truth for MINE's discoverable capabilities.
 * Status describes product implementation, never per-user access or a live API connection.
 * New tools should only be marked "available" when a real UI route exists.
 */
export type MineCapabilityCategory = 'Chat' | 'Organization' | 'Agents & Tools' | 'Creation';
export type MineCapabilityStatus = 'available' | 'planned';

export type MineCapability = {
  id: string;
  name: string;
  description: string;
  category: MineCapabilityCategory;
  status: MineCapabilityStatus;
  path?: string;
  /** Explain any permission, key, or integration needed beyond the UI route. */
  requirements?: string;
};

export const MINE_CATEGORIES: MineCapabilityCategory[] = [
  'Chat',
  'Organization',
  'Agents & Tools',
  'Creation',
];

export const MINE_CAPABILITIES: readonly MineCapability[] = [
  {
    id: 'chat',
    name: 'Multi-model Chat',
    description: 'Talk to supported models and switch providers in one workspace.',
    category: 'Chat',
    status: 'available',
    path: '/c/new',
    requirements: 'Sending requests requires an enabled model and its API access.',
  },
  {
    id: 'search',
    name: 'Search conversations',
    description: 'Find past chats and return to the original conversation.',
    category: 'Chat',
    status: 'available',
    path: '/search',
  },
  {
    id: 'projects',
    name: 'Projects',
    description: 'Organize related chats, files, and project work in one place.',
    category: 'Organization',
    status: 'available',
    path: '/projects',
  },
  {
    id: 'agents',
    name: 'Agents & Marketplace',
    description: 'Discover available AI agents and open their workspace.',
    category: 'Agents & Tools',
    status: 'available',
    path: '/agents',
    requirements: 'Availability depends on your account permissions.',
  },
  {
    id: 'skills',
    name: 'Skills',
    description: 'Explore and manage supported skills where access is enabled.',
    category: 'Agents & Tools',
    status: 'available',
    path: '/skills',
    requirements: 'Availability depends on your account permissions and server configuration.',
  },
  {
    id: 'contextual',
    name: 'Contextual Suggestions',
    description: 'Relevant tools surface naturally as you describe a goal in Chat.',
    category: 'Agents & Tools',
    status: 'planned',
  },
  {
    id: 'outcomes',
    name: 'Outcome Tracker',
    description: 'Keep a task, its approvals, files, and results connected to Chat.',
    category: 'Organization',
    status: 'planned',
  },
  {
    id: 'documents',
    name: 'MINE Docs',
    description: 'Create and edit documents beside Chat.',
    category: 'Creation',
    status: 'planned',
  },
  {
    id: 'sheets',
    name: 'MINE Sheets',
    description: 'Analyze and edit spreadsheets with AI assistance.',
    category: 'Creation',
    status: 'planned',
  },
  {
    id: 'slides',
    name: 'MINE Slides',
    description: 'Produce and refine slide presentations from a conversation.',
    category: 'Creation',
    status: 'planned',
  },
  {
    id: 'mini',
    name: 'MINI Desktop Companion',
    description: 'A floating desktop assistant for quick access to MINE.',
    category: 'Agents & Tools',
    status: 'planned',
  },
  {
    id: 'code',
    name: 'MINE Code',
    description: 'Build, preview, and iterate on apps and repositories from Chat.',
    category: 'Creation',
    status: 'planned',
  },
];
