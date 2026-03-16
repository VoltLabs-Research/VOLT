import type { SileoPosition } from 'sileo';

export type ContextualTipSurface = 'page' | 'feature' | 'action';
export type ContextualTipDismissMode = 'manual' | 'auto';

export interface ContextualTipDefinition {
    surface: ContextualTipSurface;
    dismissMode: ContextualTipDismissMode;
    title: string;
    description?: string;
    buttonLabel?: string;
    delay?: number;
    duration?: number;
    position?: SileoPosition;
};

export const CONTEXTUAL_TIPS = {
    'canvas-shortcuts': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Canvas shortcuts',
        description: 'Press ? or Ctrl+K any time to open the full shortcuts reference while you explore the canvas.',
        buttonLabel: 'Got it',
        delay: 1800,
        position: 'top-center'
    },
    'dashboard-drag-upload': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Drop files to upload',
        description: 'Drag trajectory files anywhere on the dashboard to start an upload without opening another dialog.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'latex-workspace-layout': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Resize workspace panels',
        description: 'Drag the panel dividers to reshape the LaTeX workspace, or double-click the document title to rename it in place.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'dashboard-global-search': {
        surface: 'feature',
        dismissMode: 'auto',
        title: 'Search across Volt',
        description: 'Search trajectories, containers, plugins, teams, and chats, then use Arrow keys and Enter to jump in.',
        delay: 350,
        duration: 6500,
        position: 'top-center'
    },
    'start-page-history': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Recent pages live here',
        description: 'This page keeps previews of recent visits on this device. Press Escape to toggle between Start and Dashboard.',
        buttonLabel: 'Got it',
        delay: 1200,
        position: 'top-center'
    },
    'canvas-screenshot-shortcut': {
        surface: 'action',
        dismissMode: 'auto',
        title: 'Ctrl+S takes screenshots',
        duration: 5500,
        position: 'bottom-center'
    }
} as const satisfies Record<string, ContextualTipDefinition>;

export type ContextualTipId = keyof typeof CONTEXTUAL_TIPS;

export const getContextualTipDefinition = (tipId: ContextualTipId): ContextualTipDefinition => {
    return CONTEXTUAL_TIPS[tipId];
};
