import { mergeNestedSectionState, resetSectionState } from './store-section';

import type { EditorStore } from './types';
import { PerformancePreset, PowerPreference } from '@/modules/fractal/stores/contracts/editor/performance-types';
import type { PerformanceSettingsState, PerformanceSettingsStore, DprSettings, CanvasSettings, CanvasPerformanceProp, AdaptiveEventsSettings, InteractionDegradeSettings } from '@/modules/fractal/stores/contracts/editor/performance-types';
import type { StateCreator } from 'zustand';

export interface PerformanceSlice {
    performanceSettings: PerformanceSettingsStore;
};

const presets: Record<PerformancePreset, PerformanceSettingsState> = {
    [PerformancePreset.Ultra]: {
        preset: PerformancePreset.Ultra,
        dpr: { mode: 'adaptive', fixed: 2, min: 1.5, max: 2, pixelated: false, snap: true, interactionMin: 1.25 },
        canvas: { powerPreference: PowerPreference.HighPerformance },
        performance: { current: 1, min: 0.7, max: 1, debounce: 30 },
        adaptiveEvents: { enabled: false },
        interactionDegrade: { enabled: true, debounceMs: 100 }
    },
    [PerformancePreset.High]: {
        preset: PerformancePreset.High,
        dpr: { mode: 'adaptive', fixed: 1.5, min: 1.25, max: 1.75, pixelated: false, snap: true, interactionMin: 1.0 },
        canvas: { powerPreference: PowerPreference.HighPerformance },
        performance: { current: 1, min: 0.5, max: 1, debounce: 50 },
        adaptiveEvents: { enabled: false },
        interactionDegrade: { enabled: true, debounceMs: 120 }
    },
    [PerformancePreset.Balanced]: {
        preset: PerformancePreset.Balanced,
        dpr: { mode: 'adaptive', fixed: 1.25, min: 1.0, max: 1.5, pixelated: true, snap: true, interactionMin: 0.9 },
        canvas: { powerPreference: PowerPreference.Default },
        performance: { current: 0.9, min: 0.4, max: 1, debounce: 60 },
        adaptiveEvents: { enabled: true },
        interactionDegrade: { enabled: true, debounceMs: 120 }
    },
    [PerformancePreset.Performance]: {
        preset: PerformancePreset.Performance,
        dpr: { mode: 'adaptive', fixed: 1.0, min: 0.75, max: 1.25, pixelated: true, snap: true, interactionMin: 0.75 },
        canvas: { powerPreference: PowerPreference.HighPerformance },
        performance: { current: 0.8, min: 0.3, max: 1, debounce: 80 },
        adaptiveEvents: { enabled: true },
        interactionDegrade: { enabled: true, debounceMs: 120 }
    },
    [PerformancePreset.Battery]: {
        preset: PerformancePreset.Battery,
        dpr: { mode: 'fixed', fixed: 1.0, min: 0.75, max: 1.0, pixelated: true, snap: true, interactionMin: 0.75 },
        canvas: { powerPreference: PowerPreference.HighPerformance },
        performance: { current: 0.7, min: 0.25, max: 1, debounce: 120 },
        adaptiveEvents: { enabled: true },
        interactionDegrade: { enabled: true, debounceMs: 150 }
    }
};

const initial = presets[PerformancePreset.Battery];

const cleanPowerPreference = (state: PerformanceSettingsState): PerformanceSettingsState => {
    const validPreferences: PowerPreference[] = [PowerPreference.Default, PowerPreference.HighPerformance, PowerPreference.LowPower];
    if (!validPreferences.includes(state.canvas.powerPreference)) {
        return {
            ...state,
            canvas: {
                ...state.canvas,
                powerPreference: PowerPreference.HighPerformance
            }
        };
    }
    return state;
};

const pickDpr = (
    s: PerformanceSettingsState,
    { interacting, boostScreenshot }: { interacting?: boolean; boostScreenshot?: boolean }
): number | [number, number] => {
    const { dpr, interactionDegrade } = s;
    if (dpr.mode === 'fixed') {
        return dpr.fixed;
    }
    if (boostScreenshot) {
        return [dpr.max, dpr.max];
    }
    const min = interacting && interactionDegrade.enabled ? Math.min(dpr.interactionMin, dpr.min) : dpr.min;
    return [min, dpr.max];
};

export const createPerformanceSlice: StateCreator<EditorStore, [], [], PerformanceSlice> = (set, get) => ({
    performanceSettings: {
        ...cleanPowerPreference(initial),

        setPreset: (preset: PerformancePreset) => set((state) => resetSectionState(state, 'performanceSettings', cleanPowerPreference(presets[preset]))),

        setDpr: (partial: Partial<DprSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'dpr', partial)),

        setCanvas: (partial: Partial<CanvasSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'canvas', partial)),

        setPerformance: (partial: Partial<CanvasPerformanceProp>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'performance', partial)),

        setAdaptiveEvents: (partial: Partial<AdaptiveEventsSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'adaptiveEvents', partial)),

        setInteractionDegrade: (partial: Partial<InteractionDegradeSettings>) => set((state) => mergeNestedSectionState(state, 'performanceSettings', 'interactionDegrade', partial)),

        reset: () => set((state) => resetSectionState(state, 'performanceSettings', cleanPowerPreference(initial))),

        selectCanvasDpr: (opts: { interacting?: boolean; boostScreenshot?: boolean }) => pickDpr(get().performanceSettings, opts),

        selectCanvasProps: (opts: { interacting?: boolean; boostScreenshot?: boolean }) => {
            const performanceState = get().performanceSettings;
            return {
                dpr: pickDpr(performanceState, opts),
                performance: { ...performanceState.performance }
            };
        },

        selectAdaptiveDprProps: () => {
            const performanceState = get().performanceSettings;
            return {
                enabled: performanceState.dpr.mode === 'adaptive',
                pixelated: performanceState.dpr.pixelated
            };
        }
    }
});
