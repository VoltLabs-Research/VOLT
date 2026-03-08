import type { StateCreator } from 'zustand';
import type {
    PerformancePreset,
    PerformanceSettingsState,
    PerformanceSettingsStore,
    DprSettings,
    CanvasSettings,
    CanvasPerformanceProp,
    AdaptiveEventsSettings,
    InteractionDegradeSettings,
    PowerPreference
} from '@/modules/fractal/types/stores/editor/performance-types';
import type { EditorStore } from './types';
import { mergeNestedSectionState, resetSectionState } from './store-section';

export interface PerformanceSlice {
    performanceSettings: PerformanceSettingsStore;
}

const presets: Record<PerformancePreset, PerformanceSettingsState> = {
    ultra: {
        preset: 'ultra',
        dpr: { mode: 'adaptive', fixed: 2, min: 1.5, max: 2, pixelated: false, snap: true, interactionMin: 1.25 },
        canvas: { powerPreference: 'high-performance' },
        performance: { current: 1, min: 0.7, max: 1, debounce: 30 },
        adaptiveEvents: { enabled: false },
        interactionDegrade: { enabled: true, debounceMs: 100 }
    },
    high: {
        preset: 'high',
        dpr: { mode: 'adaptive', fixed: 1.5, min: 1.25, max: 1.75, pixelated: false, snap: true, interactionMin: 1.0 },
        canvas: { powerPreference: 'high-performance' },
        performance: { current: 1, min: 0.5, max: 1, debounce: 50 },
        adaptiveEvents: { enabled: false },
        interactionDegrade: { enabled: true, debounceMs: 120 }
    },
    balanced: {
        preset: 'balanced',
        dpr: { mode: 'adaptive', fixed: 1.25, min: 1.0, max: 1.5, pixelated: true, snap: true, interactionMin: 0.9 },
        canvas: { powerPreference: 'default' },
        performance: { current: 0.9, min: 0.4, max: 1, debounce: 60 },
        adaptiveEvents: { enabled: true },
        interactionDegrade: { enabled: true, debounceMs: 120 }
    },
    performance: {
        preset: 'performance',
        dpr: { mode: 'adaptive', fixed: 1.0, min: 0.75, max: 1.25, pixelated: true, snap: true, interactionMin: 0.75 },
        canvas: { powerPreference: 'high-performance' },
        performance: { current: 0.8, min: 0.3, max: 1, debounce: 80 },
        adaptiveEvents: { enabled: true },
        interactionDegrade: { enabled: true, debounceMs: 120 }
    },
    battery: {
        preset: 'battery',
        dpr: { mode: 'fixed', fixed: 1.0, min: 0.75, max: 1.0, pixelated: true, snap: true, interactionMin: 0.75 },
        canvas: { powerPreference: 'high-performance' },
        performance: { current: 0.7, min: 0.25, max: 1, debounce: 120 },
        adaptiveEvents: { enabled: true },
        interactionDegrade: { enabled: true, debounceMs: 150 }
    }
};

const initial = presets.battery;

const cleanPowerPreference = (state: PerformanceSettingsState): PerformanceSettingsState => {
    const validPreferences: PowerPreference[] = ['default', 'high-performance', 'low-power'];
    if (!validPreferences.includes(state.canvas.powerPreference)) {
        return {
            ...state,
            canvas: {
                ...state.canvas,
                powerPreference: 'high-performance'
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
