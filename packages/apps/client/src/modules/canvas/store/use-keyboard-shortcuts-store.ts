import { create } from 'zustand';

type ShortcutScope = 'global' | 'canvas';

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
    currentScope: ShortcutScope;
    lastTriggered: ShortcutTriggered | null;
}

interface KeyboardShortcutsActions {
    setCurrentScope: (scope: ShortcutScope) => void;
    setLastTriggered: (trigger: ShortcutTriggered | null) => void;
    setShortcutEnabled: (id: string, enabled: boolean) => void;
    reset: () => void;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
    {
        id: 'play-pause',
        description: 'Play / Pause',
        keys: ['space'],
        scope: 'canvas',
        category: 'playback'
    },
    {
        id: 'timestep-prev',
        description: 'Previous timestep',
        keys: ['arrowleft'],
        scope: 'canvas',
        category: 'playback'
    },
    {
        id: 'timestep-next',
        description: 'Next timestep',
        keys: ['arrowright'],
        scope: 'canvas',
        category: 'playback'
    },
    {
        id: 'timestep-prev-10',
        description: 'Back 10 timesteps',
        keys: ['shift', 'arrowleft'],
        scope: 'canvas',
        category: 'playback'
    },
    {
        id: 'timestep-next-10',
        description: 'Forward 10 timesteps',
        keys: ['shift', 'arrowright'],
        scope: 'canvas',
        category: 'playback'
    },
    {
        id: 'timestep-first',
        description: 'First timestep',
        keys: ['home'],
        scope: 'canvas',
        category: 'playback'
    },
    {
        id: 'timestep-last',
        description: 'Last timestep',
        keys: ['end'],
        scope: 'canvas',
        category: 'playback'
    },
    {
        id: 'speed-up',
        description: 'Increase speed',
        keys: ['='],
        scope: 'canvas',
        category: 'playback'
    },
    {
        id: 'speed-down',
        description: 'Decrease speed',
        keys: ['-'],
        scope: 'canvas',
        category: 'playback'
    },
    {
        id: 'toggle-grid',
        description: 'Toggle grid',
        keys: ['g'],
        scope: 'canvas',
        category: 'view'
    },
    {
        id: 'toggle-widgets',
        description: 'Toggle widgets',
        keys: ['w'],
        scope: 'canvas',
        category: 'view'
    },
    {
        id: 'toggle-gizmo',
        description: 'Toggle gizmo',
        keys: ['shift', 'g'],
        scope: 'canvas',
        category: 'view'
    },
    {
        id: 'reset-camera',
        description: 'Reset camera',
        keys: ['r'],
        scope: 'canvas',
        category: 'view'
    },
    {
        id: 'increase-point-size',
        description: 'Increase point size',
        keys: ['ctrl', '='],
        scope: 'canvas',
        category: 'view'
    },
    {
        id: 'decrease-point-size',
        description: 'Decrease point size',
        keys: ['ctrl', '-'],
        scope: 'canvas',
        category: 'view'
    },
    {
        id: 'undo',
        description: 'Undo',
        keys: ['ctrl', 'z'],
        scope: 'canvas',
        category: 'general'
    },
    {
        id: 'redo',
        description: 'Redo',
        keys: ['ctrl', 'shift', 'z'],
        scope: 'canvas',
        category: 'general'
    },
    {
        id: 'command-palette',
        description: 'Open command palette',
        keys: ['ctrl', 'k'],
        scope: 'global',
        category: 'general'
    },
    {
        id: 'screenshot',
        description: 'Screenshot',
        keys: ['ctrl', 's'],
        scope: 'canvas',
        category: 'general'
    },
    {
        id: 'escape',
        description: 'Close panels',
        keys: ['escape'],
        scope: 'global',
        category: 'general'
    },
    {
        id: 'import-trajectory',
        description: 'Import trajectory',
        keys: ['ctrl', 'i'],
        scope: 'canvas',
        category: 'file'
    },
    {
        id: 'download-analyses',
        description: 'Download all analyses',
        keys: [],
        scope: 'canvas',
        category: 'file'
    },
    {
        id: 'toggle-fullscreen',
        description: 'Toggle fullscreen',
        keys: ['f11'],
        scope: 'canvas',
        category: 'view'
    },
    {
        id: 'toggle-status-bar',
        description: 'Toggle status bar',
        keys: [],
        scope: 'canvas',
        category: 'view'
    },
    {
        id: 'guided-tour',
        description: 'Start guided tour',
        keys: [],
        scope: 'canvas',
        category: 'help'
    },
    {
        id: 'open-docs',
        description: 'Read the docs',
        keys: [],
        scope: 'canvas',
        category: 'help'
    },
    {
        id: 'open-release-notes',
        description: 'Release notes',
        keys: [],
        scope: 'canvas',
        category: 'help'
    }
];

const DEFAULT_SHORTCUTS_MAP = new Map(DEFAULT_SHORTCUTS.map((shortcut) => [shortcut.id, shortcut] as const));

const createInitialState = (): KeyboardShortcutsState => ({
    shortcuts: new Map(DEFAULT_SHORTCUTS_MAP),
    currentScope: 'global',
    lastTriggered: null
});

export const useKeyboardShortcutsStore = create<KeyboardShortcutsState & KeyboardShortcutsActions>((set) => ({
    ...createInitialState(),

    setCurrentScope: (scope) => set({ currentScope: scope }),
    setLastTriggered: (trigger) => set({ lastTriggered: trigger }),
    setShortcutEnabled: (id, enabled) => set((state) => {
        const shortcut = state.shortcuts.get(id);
        if (!shortcut || (shortcut.enabled ?? true) === enabled) {
            return state;
        }

        const shortcuts = new Map(state.shortcuts);
        shortcuts.set(id, { ...shortcut, enabled });
        return { shortcuts };
    }),
    reset: () => set(createInitialState())
}));
