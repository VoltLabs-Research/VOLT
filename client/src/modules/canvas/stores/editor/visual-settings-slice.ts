import type { StateCreator } from 'zustand';
import type { CanvasGridSettingsState, CanvasGridSettingsStore, EnvironmentConfigStore } from '@/modules/fractal/types/stores/editor/visual-types';
import { ENVIRONMENT_DEFAULT_CONFIG } from '@/modules/fractal/types/stores/editor/visual-types';
import {
    GL_DEFAULT_CONFIG,
    ORBIT_CONTROLS_DEFAULT_CONFIG,
    SSAO_DEFAULT_CONFIG,
    type RenderConfigStore,
    type RenderConfigState
} from '@/modules/fractal/types/stores/editor/performance-types';
import type { EditorStore } from './types';
import { mergeSectionState, resetSectionState, setSectionFieldState } from './store-section';

export interface VisualSettingsSlice {
    grid: CanvasGridSettingsStore;
    environment: EnvironmentConfigStore;
    renderConfig: RenderConfigStore;
}

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

const RENDER_CONFIG_INITIAL: RenderConfigState = {
    gl: GL_DEFAULT_CONFIG,
    orbitControls: ORBIT_CONTROLS_DEFAULT_CONFIG,
    SSAO: SSAO_DEFAULT_CONFIG
};

export const createVisualSettingsSlice: StateCreator<EditorStore, [], [], VisualSettingsSlice> = (set) => ({
    grid: {
        ...GRID_INITIAL,
        setGrid: (partial: Partial<CanvasGridSettingsState>) => set((state) => mergeSectionState(state, 'grid', partial)),
        reset: () => set((state) => resetSectionState(state, 'grid', GRID_INITIAL))
    },

    environment: {
        ...ENVIRONMENT_DEFAULT_CONFIG,
        setBackgroundColor: (color: string) => set((state) => setSectionFieldState(state, 'environment', 'backgroundColor', color)),
        setBackgroundType: (type: 'color' | 'environment') => set((state) => setSectionFieldState(state, 'environment', 'backgroundType', type)),
        setEnvironmentPreset: (preset: string) => set((state) => setSectionFieldState(state, 'environment', 'environmentPreset', preset)),
        setFogConfig: (config: Record<string, unknown>) => set((state) => mergeSectionState(state, 'environment', config as Partial<EnvironmentConfigStore>)),
        setToneMappingExposure: (exposure: number) => set((state) => setSectionFieldState(state, 'environment', 'toneMappingExposure', exposure)),
        reset: () => set((state) => resetSectionState(state, 'environment', ENVIRONMENT_DEFAULT_CONFIG))
    },

    renderConfig: {
        ...RENDER_CONFIG_INITIAL,
        reset: () => set((state) => resetSectionState(state, 'renderConfig', RENDER_CONFIG_INITIAL))
    }
});
