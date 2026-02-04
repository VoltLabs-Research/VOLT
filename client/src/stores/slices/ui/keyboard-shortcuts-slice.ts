import { create } from 'zustand';

export interface Shortcut {
    id: string;
    /** Key combination, e.g. ['ctrl', 'shift', 's'] */
    keys: string[];
    description: string;
    category: 'playback' | 'navigation' | 'view' | 'tools' | 'general';
    /** Callback when shortcut is triggered */
    action: () => void;
    /** Whether the shortcut is enabled */
    enabled?: boolean;
    /** Scope where the shortcut is active */
    scope?: 'global' | 'canvas' | 'sidebar';
}

interface ShortcutsState {
    shortcuts: Map<string, Shortcut>;
    showPanel: boolean;
    lastTriggered: { id: string; description: string } | null;
    currentScope: 'global' | 'canvas' | 'sidebar';
}

interface ShortcutsActions {
    registerShortcut: (shortcut: Shortcut) => void;
    unregisterShortcut: (id: string) => void;
    updateShortcutAction: (id: string, action: () => void) => void;
    setShowPanel: (show: boolean) => void;
    togglePanel: () => void;
    setLastTriggered: (shortcut: { id: string; description: string } | null) => void;
    setCurrentScope: (scope: 'global' | 'canvas' | 'sidebar') => void;
    getShortcutsByCategory: () => Record<string, Shortcut[]>;
    triggerShortcut: (id: string) => void;
}

type ShortcutsStore = ShortcutsState & ShortcutsActions;

const DEFAULT_SHORTCUTS: Shortcut[] = [
    // Playback
    { id: 'play-pause', keys: ['space'], description: 'Play/Pause', category: 'playback', action: () => { }, scope: 'canvas' },
    { id: 'frame-prev', keys: ['arrowleft'], description: 'Previous frame', category: 'playback', action: () => { }, scope: 'canvas' },
    { id: 'frame-next', keys: ['arrowright'], description: 'Next frame', category: 'playback', action: () => { }, scope: 'canvas' },
    { id: 'frame-prev-10', keys: ['shift', 'arrowleft'], description: 'Back 10 frames', category: 'playback', action: () => { }, scope: 'canvas' },
    { id: 'frame-next-10', keys: ['shift', 'arrowright'], description: 'Forward 10 frames', category: 'playback', action: () => { }, scope: 'canvas' },
    { id: 'frame-first', keys: ['home'], description: 'First frame', category: 'playback', action: () => { }, scope: 'canvas' },
    { id: 'frame-last', keys: ['end'], description: 'Last frame', category: 'playback', action: () => { }, scope: 'canvas' },
    { id: 'speed-up', keys: [']'], description: 'Increase speed', category: 'playback', action: () => { }, scope: 'canvas' },
    { id: 'speed-down', keys: ['['], description: 'Decrease speed', category: 'playback', action: () => { }, scope: 'canvas' },

    // View
    { id: 'toggle-grid', keys: ['g'], description: 'Toggle grid', category: 'view', action: () => { }, scope: 'canvas' },
    { id: 'toggle-widgets', keys: ['w'], description: 'Toggle widgets', category: 'view', action: () => { }, scope: 'canvas' },
    { id: 'reset-camera', keys: ['r'], description: 'Reset camera', category: 'view', action: () => { }, scope: 'canvas' },

    // Tools
    { id: 'color-coding', keys: ['c'], description: 'Color coding', category: 'tools', action: () => { }, scope: 'canvas' },
    { id: 'slice-plane', keys: ['x'], description: 'Slice plane', category: 'tools', action: () => { }, scope: 'canvas' },
    { id: 'particle-filter', keys: ['p'], description: 'Particle filter', category: 'tools', action: () => { }, scope: 'canvas' },

    // Atom Size
    { id: 'increase-point-size', keys: ['+'], description: 'Increase atom size', category: 'view', action: () => { }, scope: 'canvas' },
    { id: 'decrease-point-size', keys: ['-'], description: 'Decrease atom size', category: 'view', action: () => { }, scope: 'canvas' },

    // Settings
    { id: 'toggle-opacity-settings', keys: ['ctrl', 'o'], description: 'Toggle opacity settings', category: 'view', action: () => { }, scope: 'canvas' },

    // General
    { id: 'show-shortcuts', keys: ['ctrl', 'k'], description: 'Show keyboard shortcuts', category: 'general', action: () => { }, scope: 'global' },
    { id: 'escape', keys: ['escape'], description: 'Close active panel', category: 'general', action: () => { }, scope: 'global' },
];

export const useKeyboardShortcutsStore = create<ShortcutsStore>((set, get) => ({
    shortcuts: new Map(DEFAULT_SHORTCUTS.map(s => [s.id, s])),
    showPanel: false,
    lastTriggered: null,
    currentScope: 'global',

    registerShortcut: (shortcut) => {
        set((state) => {
            const newShortcuts = new Map(state.shortcuts);
            newShortcuts.set(shortcut.id, shortcut);
            return { shortcuts: newShortcuts };
        });
    },

    unregisterShortcut: (id) => {
        set((state) => {
            const newShortcuts = new Map(state.shortcuts);
            newShortcuts.delete(id);
            return { shortcuts: newShortcuts };
        });
    },

    updateShortcutAction: (id, action) => {
        set((state) => {
            const newShortcuts = new Map(state.shortcuts);
            const existing = newShortcuts.get(id);
            if (existing) {
                newShortcuts.set(id, { ...existing, action });
            }
            return { shortcuts: newShortcuts };
        });
    },

    setShowPanel: (show) => set({ showPanel: show }),

    togglePanel: () => set((state) => ({ showPanel: !state.showPanel })),

    setLastTriggered: (shortcut) => set({ lastTriggered: shortcut }),

    setCurrentScope: (scope) => set({ currentScope: scope }),

    getShortcutsByCategory: () => {
        const { shortcuts } = get();
        const groups: Record<string, Shortcut[]> = {};

        for (const shortcut of shortcuts.values()) {
            if (!groups[shortcut.category]) {
                groups[shortcut.category] = [];
            }
            groups[shortcut.category].push(shortcut);
        }

        return groups;
    },

    triggerShortcut: (id) => {
        const { shortcuts, setLastTriggered } = get();
        const shortcut = shortcuts.get(id);

        if (shortcut && (shortcut.enabled !== false)) {
            shortcut.action();
            setLastTriggered({ id, description: shortcut.description });

            // Clear after animation
            setTimeout(() => setLastTriggered(null), 1500);
        }
    }
}));
