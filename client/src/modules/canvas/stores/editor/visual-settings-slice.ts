import { mergeSectionState, resetSectionState, setSectionFieldState } from './store-section';
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

const GRID_INITIAL: CanvasGridSettingsState = {
    enabled: false,
    infiniteGrid: true,
    cellSize: 0.75,
    sectionSize: 3,
    cellThickness: 0.5,
    sectionThickness: 1,
    fadeDistance: 100,
    fadeStrength: 2,
    sectionColor: '#262626',
    cellColor: '#161616',
    position: [0, 0, 0],
    rotation: [Math.PI / 2, 0, 0]
};

export const createVisualSettingsSlice: StateCreator<EditorStore, [], [], VisualSettingsSlice> = (set) => ({
    grid: {
        ...GRID_INITIAL,
        setGrid: (partial: Partial<CanvasGridSettingsState>) => set((state) => mergeSectionState(state, 'grid', partial)),
        reset: () => set((state) => resetSectionState(state, 'grid', GRID_INITIAL))
    },
    environment: {
        ...getDefaultEnvironmentSettings(),
        setBackgroundColor: (color: string) => set((state) => setSectionFieldState(state, 'environment', 'backgroundColor', color)),
        setFogConfig: (config: Partial<FogConfig>) => set((state) => mergeSectionState(state, 'environment', config)),
        reset: () => set((state) => resetSectionState(state, 'environment', getDefaultEnvironmentSettings()))
    }
});
