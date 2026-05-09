import { mergeNestedSectionState, resetSectionState } from './store-section';
import {
    DEFAULT_PERFORMANCE_PRESET,
    getPerformancePresetPowerPreference,
    getPerformancePresetState,
    getValidatedPerformanceSettingsState,
    resolveAdaptiveDprProps,
    resolveCanvasDpr,
    resolveCanvasRuntimeProps
} from '@/shared/domain/rendering/performance';

import type { EditorStore } from './types';
import type { PerformanceSettingsStore } from '@/modules/fractal/stores/contracts/editor/performance-types';
import type { AdaptiveEventsSettings, CanvasPerformanceProp, DprSettings, InteractionDegradeSettings, PerformanceSettingsState } from '@/shared/domain/rendering/performance';
import type { StateCreator } from 'zustand';

export interface PerformanceSlice {
    performanceSettings: PerformanceSettingsStore;
}

const getInitialPerformanceSettings = (): PerformanceSettingsState => {
    return getValidatedPerformanceSettingsState(getPerformancePresetState(DEFAULT_PERFORMANCE_PRESET));
};

export const createPerformanceSlice: StateCreator<EditorStore, [], [], PerformanceSlice> = (set, get) => ({
    performanceSettings: {
        ...getInitialPerformanceSettings(),
        setPreset: (preset) => set((state) => {
            const nextPerformanceSettings = getValidatedPerformanceSettingsState(getPerformancePresetState(preset));

            return {
                ...resetSectionState(state, 'performanceSettings', nextPerformanceSettings),
                ...mergeNestedSectionState(state, 'rendererSettings', 'create', {
                    powerPreference: getPerformancePresetPowerPreference(preset)
                })
            };
        }),
        setDpr: (partial: Partial<DprSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'dpr', partial)),
        setPerformance: (partial: Partial<CanvasPerformanceProp>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'performance', partial)),
        setAdaptiveEvents: (partial: Partial<AdaptiveEventsSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'adaptiveEvents', partial)),
        setInteractionDegrade: (partial: Partial<InteractionDegradeSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'interactionDegrade', partial)),
        reset: () => set((state) => ({
            ...resetSectionState(state, 'performanceSettings', getInitialPerformanceSettings()),
            ...mergeNestedSectionState(state, 'rendererSettings', 'create', {
                powerPreference: getPerformancePresetPowerPreference(DEFAULT_PERFORMANCE_PRESET)
            })
        })),
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
