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
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
    { id: 'play-pause', description: 'Play / Pause', keys: ['space'], scope: 'canvas', category: 'playback' },
    { id: 'frame-prev', description: 'Previous frame', keys: ['arrowleft'], scope: 'canvas', category: 'playback' },
    { id: 'frame-next', description: 'Next frame', keys: ['arrowright'], scope: 'canvas', category: 'playback' },
    { id: 'frame-prev-10', description: 'Back 10 frames', keys: ['shift', 'arrowleft'], scope: 'canvas', category: 'playback' },
    { id: 'frame-next-10', description: 'Forward 10 frames', keys: ['shift', 'arrowright'], scope: 'canvas', category: 'playback' },
    { id: 'frame-first', description: 'First frame', keys: ['home'], scope: 'canvas', category: 'playback' },
    { id: 'frame-last', description: 'Last frame', keys: ['end'], scope: 'canvas', category: 'playback' },
    { id: 'speed-up', description: 'Increase speed', keys: ['='], scope: 'canvas', category: 'playback' },
    { id: 'speed-down', description: 'Decrease speed', keys: ['-'], scope: 'canvas', category: 'playback' },
    { id: 'toggle-grid', description: 'Toggle grid', keys: ['g'], scope: 'canvas', category: 'view' },
    { id: 'toggle-widgets', description: 'Toggle widgets', keys: ['w'], scope: 'canvas', category: 'view' },
    { id: 'reset-camera', description: 'Reset camera', keys: ['r'], scope: 'canvas', category: 'view' },
    { id: 'increase-point-size', description: 'Increase point size', keys: ['ctrl', '='], scope: 'canvas', category: 'view' },
    { id: 'decrease-point-size', description: 'Decrease point size', keys: ['ctrl', '-'], scope: 'canvas', category: 'view' },
    { id: 'show-shortcuts', description: 'Show shortcuts', keys: ['?'], scope: 'global', category: 'general' },
    { id: 'show-shortcuts-ctrl-k', description: 'Show shortcuts', keys: ['ctrl', 'k'], scope: 'global', category: 'general' },
    { id: 'escape', description: 'Close panels', keys: ['escape'], scope: 'global', category: 'general' }
];

const DEFAULT_SHORTCUTS_MAP = new Map(DEFAULT_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut] as const));

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
    shortcuts: DEFAULT_SHORTCUTS_MAP,
    showPanel: false,
    currentScope: 'global',
    lastTriggered: null,

    togglePanel: () => set((state) => ({ showPanel: !state.showPanel })),
    setShowPanel: (value) => set({ showPanel: value }),
    setCurrentScope: (scope) => set({ currentScope: scope }),
    setLastTriggered: (trigger) => set({ lastTriggered: trigger }),
    getShortcutsByCategory: () => groupShortcuts(get().shortcuts)
}));
