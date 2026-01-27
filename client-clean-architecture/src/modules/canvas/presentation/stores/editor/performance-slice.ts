import type { StateCreator } from 'zustand';
import type {
    PerformancePreset,
    PerformanceSettingsState,
    PerformanceSettingsStore
} from '@/types/stores/editor/perfomance-settings';

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
    perfomance: {
        preset: 'perfomance',
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
    if (state.canvas.powerPreference === 'high-perfomance' as any) {
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

export const createPerformanceSlice: StateCreator<any, [], [], PerformanceSlice> = (set, get) => ({
    performanceSettings: {
        ...cleanPowerPreference(initial),

        setPreset: (preset) => set((s: any) => ({ performanceSettings: { ...s.performanceSettings, ...cleanPowerPreference(presets[preset]) } })),

        setDpr: (partial) => set((s: any) => ({
            performanceSettings: { ...s.performanceSettings, dpr: { ...s.performanceSettings.dpr, ...partial } }
        })),

        setCanvas: (partial) => set((s: any) => ({
            performanceSettings: { ...s.performanceSettings, canvas: { ...s.performanceSettings.canvas, ...partial } }
        })),

        setPerformance: (partial) => set((s: any) => ({
            performanceSettings: { ...s.performanceSettings, performance: { ...s.performanceSettings.performance, ...partial } }
        })),

        setAdaptiveEvents: (partial) => set((s: any) => ({
            performanceSettings: { ...s.performanceSettings, adaptiveEvents: { ...s.performanceSettings.adaptiveEvents, ...partial } }
        })),

        setInteractionDegrade: (partial) => set((s: any) => ({
            performanceSettings: { ...s.performanceSettings, interactionDegrade: { ...s.performanceSettings.interactionDegrade, ...partial } }
        })),

        reset: () => set((s: any) => ({ performanceSettings: { ...s.performanceSettings, ...cleanPowerPreference(initial) } })),

        selectCanvasDpr: (opts) => pickDpr(get().performanceSettings, opts),

        selectCanvasProps: (opts) => {
            const s = get().performanceSettings;
            return {
                dpr: pickDpr(s, opts),
                performance: { ...s.performance }
            };
        },

        selectAdaptiveDprProps: () => {
            const s = get().performanceSettings;
            return {
                enabled: s.dpr.mode === 'adaptive',
                pixelated: s.dpr.pixelated
            };
        }
    }
});
