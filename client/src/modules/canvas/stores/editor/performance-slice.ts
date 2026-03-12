import { mergeNestedSectionState, resetSectionState } from './store-section';
import {
    DEFAULT_PERFORMANCE_PRESET,
    PerformancePreset,
    getPerformancePresetState,
    getValidatedPerformanceSettingsState,
    resolveAdaptiveDprProps,
    resolveCanvasDpr,
    resolveCanvasRuntimeProps
} from '@/shared/domain/rendering/performance';

import type { EditorStore } from './types';
import type {
    AdaptiveEventsSettings,
    CanvasPerformanceProp,
    CanvasSettings,
    DprSettings,
    InteractionDegradeSettings,
    PerformanceSettingsState,
    PerformanceSettingsStore
} from '@/modules/fractal/stores/contracts/editor/performance-types';
import type { StateCreator } from 'zustand';

export interface PerformanceSlice {
    performanceSettings: PerformanceSettingsStore;
};

const getInitialPerformanceSettings = (): PerformanceSettingsState => {
    return getValidatedPerformanceSettingsState(getPerformancePresetState(DEFAULT_PERFORMANCE_PRESET));
};

export const createPerformanceSlice: StateCreator<EditorStore, [], [], PerformanceSlice> = (set, get) => ({
    performanceSettings: {
        ...getInitialPerformanceSettings(),

        setPreset: (preset: PerformancePreset) => set((state) => {
            const nextPerformanceSettings = getValidatedPerformanceSettingsState(
                getPerformancePresetState(preset)
            );

            return resetSectionState(state, 'performanceSettings', nextPerformanceSettings);
        }),

        setDpr: (partial: Partial<DprSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'dpr', partial)),

        setCanvas: (partial: Partial<CanvasSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'canvas', partial)),

        setPerformance: (partial: Partial<CanvasPerformanceProp>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'performance', partial)),

        setAdaptiveEvents: (partial: Partial<AdaptiveEventsSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'adaptiveEvents', partial)),

        setInteractionDegrade: (partial: Partial<InteractionDegradeSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'interactionDegrade', partial)),

        reset: () => set((state) => resetSectionState(state, 'performanceSettings', getInitialPerformanceSettings())),

        selectCanvasDpr: (options) => {
            const performanceState = get().performanceSettings;
            return resolveCanvasDpr({
                dpr: performanceState.dpr,
                interactionDegradeEnabled: performanceState.interactionDegrade.enabled
            }, options);
        },

        selectCanvasProps: (options) => {
            const performanceState = get().performanceSettings;
            return resolveCanvasRuntimeProps({
                dpr: performanceState.dpr,
                performance: performanceState.performance,
                interactionDegradeEnabled: performanceState.interactionDegrade.enabled
            }, options);
        },

        selectAdaptiveDprProps: () => {
            const performanceState = get().performanceSettings;
            return resolveAdaptiveDprProps({ dpr: performanceState.dpr });
        }
    }
});
