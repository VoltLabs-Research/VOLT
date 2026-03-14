import { mergeSectionState, resetSectionState } from './store-section';
import { getDefaultEnvironmentSettings } from '@/shared/domain/rendering/environment';

import type { EditorStore } from './types';
import type {
    CanvasGridSettingsState,
    CanvasGridSettingsStore,
    EnvironmentConfigStore,
    FogConfig
} from '@/modules/fractal/stores/contracts/editor/visual-types';
import type { StateCreator } from 'zustand';

export interface VisualSettingsSlice {
    grid: CanvasGridSettingsStore;
    environment: EnvironmentConfigStore;
};

interface GridThemeDefaults {
    sectionColor: string;
    cellColor: string;
};

const resolveFogConfigUpdate = (config: Partial<FogConfig>): Partial<FogConfig> => {
    if (typeof config.fogColor === 'string') {
        return {
            ...config,
            fogColorFollowsTheme: false
        };
    }

    return config;
};

const DARK_GRID_DEFAULTS: GridThemeDefaults = {
    sectionColor: '#262626',
    cellColor: '#161616'
};

const LIGHT_GRID_DEFAULTS: GridThemeDefaults = {
    sectionColor: '#d1d1d6',
    cellColor: '#e5e5ea'
};

const isDarkTheme = (): boolean => {
    if (typeof document === 'undefined') {
        return true;
    }

    return document.documentElement.getAttribute('data-theme') !== 'light';
};

const getGridThemeDefaults = (darkTheme = isDarkTheme()): GridThemeDefaults => {
    if (darkTheme) {
        return DARK_GRID_DEFAULTS;
    }

    return LIGHT_GRID_DEFAULTS;
};

const createGridSettings = (darkTheme = isDarkTheme()): CanvasGridSettingsState => {
    const defaults = getGridThemeDefaults(darkTheme);

    return {
        enabled: false,
        infiniteGrid: true,
        cellSize: 0.75,
        sectionSize: 3,
        cellThickness: 0.5,
        sectionThickness: 1,
        fadeDistance: 100,
        fadeStrength: 2,
        sectionColor: defaults.sectionColor,
        sectionColorFollowsTheme: true,
        cellColor: defaults.cellColor,
        cellColorFollowsTheme: true,
        position: [0, 0, 0],
        rotation: [Math.PI / 2, 0, 0]
    };
};

const resolveGridConfigUpdate = (config: Partial<CanvasGridSettingsState>): Partial<CanvasGridSettingsState> => {
    const nextConfig = { ...config };

    if (typeof config.sectionColor === 'string') {
        nextConfig.sectionColorFollowsTheme = false;
    }

    if (typeof config.cellColor === 'string') {
        nextConfig.cellColorFollowsTheme = false;
    }

    return nextConfig;
};

const GRID_INITIAL: CanvasGridSettingsState = createGridSettings();

export const createVisualSettingsSlice: StateCreator<EditorStore, [], [], VisualSettingsSlice> = (set) => ({
    grid: {
        ...GRID_INITIAL,
        setGrid: (partial: Partial<CanvasGridSettingsState>) => set((state) => mergeSectionState(state, 'grid', resolveGridConfigUpdate(partial))),
        reset: () => set((state) => resetSectionState(state, 'grid', createGridSettings()))
    },
    environment: {
        ...getDefaultEnvironmentSettings(),
        setBackgroundColor: (color: string) => set((state) => mergeSectionState(state, 'environment', {
            backgroundColor: color,
            backgroundColorFollowsTheme: false
        })),
        setFogConfig: (config: Partial<FogConfig>) => set((state) => mergeSectionState(state, 'environment', resolveFogConfigUpdate(config))),
        reset: () => set((state) => resetSectionState(state, 'environment', getDefaultEnvironmentSettings()))
    }
});
