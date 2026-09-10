import { mergeNestedSectionState, resetSectionState } from './store-section';
import {
    DEFAULT_PERFORMANCE_PRESET,
    getPerformancePresetPowerPreference,
    getPerformancePresetState,
    getValidatedPerformanceSettingsState
} from '@/shared/rendering/performance';

import type { EditorStore } from './types';
import type { PerformancePreset, PerformanceSettingsState } from '@/shared/rendering/performance';
import type { StateCreator } from 'zustand';

interface PerformanceSettingsActions {
    setPreset: (preset: PerformancePreset) => void;
    reset: () => void;
}

type PerformanceSettingsStore = PerformanceSettingsState & PerformanceSettingsActions;

export interface PerformanceSlice {
    performanceSettings: PerformanceSettingsStore;
}

const getInitialPerformanceSettings = (): PerformanceSettingsState => {
    return getValidatedPerformanceSettingsState(getPerformancePresetState(DEFAULT_PERFORMANCE_PRESET));
};

export const createPerformanceSlice: StateCreator<EditorStore, [], [], PerformanceSlice> = (set) => ({
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
        reset: () => set((state) => ({
            ...resetSectionState(state, 'performanceSettings', getInitialPerformanceSettings()),
            ...mergeNestedSectionState(state, 'rendererSettings', 'create', {
                powerPreference: getPerformancePresetPowerPreference(DEFAULT_PERFORMANCE_PRESET)
            })
        }))
    }
});
