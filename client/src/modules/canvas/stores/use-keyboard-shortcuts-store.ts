import { create } from 'zustand';

export type ShortcutScope = 'global' | 'canvas';

export interface Shortcut {
    id: string;
    description: string;
    keys: string[];
    scope?: ShortcutScope;
    category?: string;
    enabled?: boolean;
}

interface ShortcutTriggered {
    id: string;
    description: string;
}

interface KeyboardShortcutsState {
    shortcuts: Map<string, Shortcut>;
    showPanel: boolean;
    currentScope: ShortcutScope;
    lastTriggered: ShortcutTriggered | null;
}

interface KeyboardShortcutsActions {
    togglePanel: () => void;
    setShowPanel: (value: boolean) => void;
    setCurrentScope: (scope: ShortcutScope) => void;
    setLastTriggered: (trigger: ShortcutTriggered | null) => void;
    getShortcutsByCategory: () => Record<string, Shortcut[]>;
    reset: () => void;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
    { id: 'play-pause', description: 'Play / Pause', keys: ['space'], scope: 'canvas', category: 'playback' },
    { id: 'timestep-prev', description: 'Previous timestep', keys: ['arrowleft'], scope: 'canvas', category: 'playback' },
    { id: 'timestep-next', description: 'Next timestep', keys: ['arrowright'], scope: 'canvas', category: 'playback' },
    { id: 'timestep-prev-10', description: 'Back 10 timesteps', keys: ['shift', 'arrowleft'], scope: 'canvas', category: 'playback' },
    { id: 'timestep-next-10', description: 'Forward 10 timesteps', keys: ['shift', 'arrowright'], scope: 'canvas', category: 'playback' },
    { id: 'timestep-first', description: 'First timestep', keys: ['home'], scope: 'canvas', category: 'playback' },
    { id: 'timestep-last', description: 'Last timestep', keys: ['end'], scope: 'canvas', category: 'playback' },
    { id: 'speed-up', description: 'Increase speed', keys: ['='], scope: 'canvas', category: 'playback' },
    { id: 'speed-down', description: 'Decrease speed', keys: ['-'], scope: 'canvas', category: 'playback' },
    { id: 'toggle-grid', description: 'Toggle grid', keys: ['g'], scope: 'canvas', category: 'view' },
    { id: 'toggle-widgets', description: 'Toggle widgets', keys: ['w'], scope: 'canvas', category: 'view' },
    { id: 'toggle-gizmo', description: 'Toggle gizmo', keys: ['shift', 'g'], scope: 'canvas', category: 'view' },
    { id: 'reset-camera', description: 'Reset camera', keys: ['r'], scope: 'canvas', category: 'view' },
    { id: 'increase-point-size', description: 'Increase point size', keys: ['ctrl', '='], scope: 'canvas', category: 'view' },
    { id: 'decrease-point-size', description: 'Decrease point size', keys: ['ctrl', '-'], scope: 'canvas', category: 'view' },
    { id: 'undo', description: 'Undo', keys: ['ctrl', 'z'], scope: 'canvas', category: 'general' },
    { id: 'redo', description: 'Redo', keys: ['ctrl', 'shift', 'z'], scope: 'canvas', category: 'general' },
    { id: 'show-shortcuts', description: 'Show shortcuts', keys: ['?'], scope: 'global', category: 'general' },
    { id: 'command-palette', description: 'Open command palette', keys: ['ctrl', 'k'], scope: 'global', category: 'general' },
    { id: 'screenshot', description: 'Screenshot', keys: ['ctrl', 's'], scope: 'canvas', category: 'general' },
    { id: 'escape', description: 'Close panels', keys: ['escape'], scope: 'global', category: 'general' }
];

const DEFAULT_SHORTCUTS_MAP = new Map(DEFAULT_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut] as const));

const createInitialState = (): KeyboardShortcutsState => ({
    shortcuts: new Map(DEFAULT_SHORTCUTS_MAP),
    showPanel: false,
    currentScope: 'global',
    lastTriggered: null
});

const groupShortcuts = (shortcuts: Map<string, Shortcut>) => {
    const groups: Record<string, Shortcut[]> = {};
    shortcuts.forEach((shortcut) => {
        const category = shortcut.category ?? 'general';
        if (!groups[category]) groups[category] = [];
        groups[category].push(shortcut);
    });
    return groups;
};

export const useKeyboardShortcutsStore = create<KeyboardShortcutsState & KeyboardShortcutsActions>((set, get) => ({
    ...createInitialState(),

    togglePanel: () => set((state) => ({ showPanel: !state.showPanel })),
    setShowPanel: (value) => set({ showPanel: value }),
    setCurrentScope: (scope) => set({ currentScope: scope }),
    setLastTriggered: (trigger) => set({ lastTriggered: trigger }),
    getShortcutsByCategory: () => groupShortcuts(get().shortcuts),
    reset: () => set(createInitialState())
}));
