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
    },
    'dashboard-sidebar-collapse': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Maximize your workspace',
        description: 'Collapse the sidebar to give dashboards, tables, and editors more space without leaving the page.',
        buttonLabel: 'Got it',
        delay: 1800,
        position: 'top-center'
    },
    'team-selector-context': {
        surface: 'feature',
        dismissMode: 'auto',
        title: 'Teams change your context',
        description: 'Switch teams here to update the dashboards, chats, containers, and resources you are working with.',
        delay: 250,
        duration: 6500,
        position: 'top-center'
    },
    'containers-organization': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Organize containers with folders',
        description: 'Create folders, move containers, and keep large container lists easier to navigate over time.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'container-details-tabs': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Terminal and files work together',
        description: 'Use the Terminal and Storage sections together when you need to inspect, debug, or verify changes inside a container.',
        buttonLabel: 'Got it',
        delay: 1500,
        position: 'top-center'
    },
    'ssh-file-explorer-navigation': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Browse remote files quickly',
        description: 'Open folders to navigate, use the breadcrumb to jump back, and refresh the current path whenever the remote state changes.',
        buttonLabel: 'Got it',
        delay: 1400,
        position: 'top-center'
    },
    'plugin-builder-get-started': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Start by placing a node',
        description: 'Drag a node from the palette into the canvas, then connect outputs and inputs to build your workflow.',
        buttonLabel: 'Got it',
        delay: 1200,
        position: 'top-center'
    },
    'plugin-builder-shortcuts': {
        surface: 'feature',
        dismissMode: 'auto',
        title: 'Builder shortcuts help',
        description: 'Use Ctrl+S to save, Delete to remove the selected node, and Ctrl+Z to undo changes.',
        delay: 250,
        duration: 6500,
        position: 'top-center'
    },
    'cluster-terminal-context': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'You are on the cluster host',
        description: 'This terminal connects to the selected cluster host directly, so commands here affect the remote environment.',
        buttonLabel: 'Got it',
        delay: 1200,
        position: 'top-center'
    },
    'whiteboard-collaboration': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Whiteboards are collaborative',
        description: 'Changes sync live, and the presence indicator shows how many collaborators are active on this board right now.',
        buttonLabel: 'Got it',
        delay: 1400,
        position: 'top-center'
    },
    'messages-details-panel': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Open chat details for more',
        description: 'Use the details panel to review members, activity, and group settings without leaving the conversation.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    }
} as const satisfies Record<string, ContextualTipDefinition>;

export type ContextualTipId = keyof typeof CONTEXTUAL_TIPS;

export const getContextualTipDefinition = (tipId: ContextualTipId): ContextualTipDefinition => {
    return CONTEXTUAL_TIPS[tipId];
};
