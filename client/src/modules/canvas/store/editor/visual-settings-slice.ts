import { mergeSectionState, resetSectionState } from './store-section';
import { getDefaultEnvironmentSettings } from '@/shared/rendering/environment';
import { getGridThemeDefaults } from '@/shared/rendering/grid';

import type { EditorStore } from './types';
import type { CanvasGridSettingsState, CanvasGridSettingsStore, EnvironmentConfigStore, FogConfig } from '@/modules/fractal/contracts/editor/visual-types';
import type { StateCreator } from 'zustand';

export interface VisualSettingsSlice {
    grid: CanvasGridSettingsStore;
    environment: EnvironmentConfigStore;
}

const resolveFogConfigUpdate = (config: Partial<FogConfig>): Partial<FogConfig> => {
    if (config.fogColor !== undefined) {
        return {
            ...config,
            fogColorFollowsTheme: false
        };
    }

    return config;
};

const isDarkTheme = (): boolean => {
    return document.documentElement.getAttribute('data-theme') !== 'light';
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

    if (config.sectionColor !== undefined) {
        nextConfig.sectionColorFollowsTheme = false;
    }

    if (config.cellColor !== undefined) {
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
