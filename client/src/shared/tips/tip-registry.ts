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
    'whiteboards-organization': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Organize whiteboards with folders',
        description: 'Create folders, move whiteboards, and keep large board collections easier to navigate over time.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'trajectories-organization': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Organize trajectories with folders',
        description: 'Create folders, move trajectories, and keep large trajectory lists easier to navigate over time.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'latex-documents-organization': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Organize documents with folders',
        description: 'Create folders, move documents, and keep large document collections easier to navigate over time.',
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
    },
    'ai-spreadsheet-panel': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Resize the artifact panel',
        description: 'Drag the panel divider to adjust the spreadsheet area, or collapse it to focus on the conversation.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'secret-keys-quick-create': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Press N to create a key',
        description: 'Use the keyboard shortcut N to start creating a new secret key without reaching for the button.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'canvas-timeline-scrub': {
        surface: 'feature',
        dismissMode: 'auto',
        title: 'Scrub the timeline to navigate',
        description: 'Drag the ruler to jump between timesteps, use Arrow keys to step frame by frame, or mouse wheel to scroll.',
        delay: 350,
        duration: 6500,
        position: 'bottom-center'
    },
    'cluster-remote-explorer': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Explore cluster databases',
        description: 'Browse MongoDB collections, Redis keys, and MinIO buckets directly from this panel.',
        buttonLabel: 'Got it',
        delay: 1400,
        position: 'top-center'
    },
    'plugins-import-export': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Import and export plugins',
        description: 'Export plugins as .zip to share them, or import .zip files to install plugins from others.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'chat-file-attachments': {
        surface: 'feature',
        dismissMode: 'auto',
        title: 'Attach files to messages',
        description: 'Drag files or use the attachment button to share files in the conversation. Press Enter to send, Shift+Enter for a new line.',
        delay: 350,
        duration: 6500,
        position: 'bottom-center'
    },
    'container-create-stepper': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Follow the steps to deploy',
        description: 'Walk through Image, Configuration, and Review before creating the container.',
        buttonLabel: 'Got it',
        delay: 1200,
        position: 'top-center'
    },
    'cluster-monitoring-live': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Metrics update in real time',
        description: 'CPU, memory, network, and disk charts refresh automatically to reflect the current cluster state.',
        buttonLabel: 'Got it',
        delay: 1400,
        position: 'top-center'
    },
    'notebook-workspace': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Jupyter runs inside a container',
        description: 'The notebook starts with its own container. Wait for it to be ready before interacting with cells.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'canvas-render-settings': {
        surface: 'feature',
        dismissMode: 'auto',
        title: 'Fine-tune the 3D rendering',
        description: 'Use the Render and Camera menus in the viewport header to adjust lights, effects, point clouds, environment, and camera settings.',
        delay: 350,
        duration: 6500,
        position: 'top-center'
    },
    'container-env-vars': {
        surface: 'feature',
        dismissMode: 'auto',
        title: 'Edit environment variables live',
        description: 'Update environment variables and port bindings directly from the overview without redeploying.',
        delay: 350,
        duration: 6500,
        position: 'top-center'
    },
    'team-roles-permissions': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Roles control access granularly',
        description: 'Assign permissions per resource type to control what each team member can see and do.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'team-integrations': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Connect AI providers here',
        description: 'Add API keys for AI models, configure Ollama endpoints, and manage which models are available.',
        buttonLabel: 'Got it',
        delay: 1600,
        position: 'top-center'
    },
    'general-settings-tips-toggle': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Toggle contextual tips',
        description: 'Enable or disable these onboarding tips from the general settings page at any time.',
        buttonLabel: 'Got it',
        delay: 1800,
        position: 'top-center'
    },
    'session-management': {
        surface: 'page',
        dismissMode: 'manual',
        title: 'Review active sessions',
        description: 'See all devices with active sessions and revoke any you do not recognize.',
        buttonLabel: 'Got it',
        delay: 1400,
        position: 'top-center'
    },
    'notifications-mark-read': {
        surface: 'feature',
        dismissMode: 'auto',
        title: 'Mark all notifications as read',
        description: 'Use the header action to clear all unread notifications at once.',
        delay: 350,
        duration: 5500,
        position: 'top-center'
    }
} as const satisfies Record<string, ContextualTipDefinition>;

export type ContextualTipId = keyof typeof CONTEXTUAL_TIPS;

export const getContextualTipDefinition = (tipId: ContextualTipId): ContextualTipDefinition => {
    return CONTEXTUAL_TIPS[tipId];
};
