import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
    PerformancePreset, 
    PerformanceSettingsState,
    PerformanceSettingsStore 
} from '@/types/stores/editor/perfomance-settings';

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
        //canvas: { powerPreference: 'low-power' },
        canvas: { powerPreference: 'high-performance' },
        performance: { current: 0.7, min: 0.25, max: 1, debounce: 120 },
        adaptiveEvents: { enabled: true },
        interactionDegrade: { enabled: true, debounceMs: 150 }
    }
};


const initial = presets.battery;
    
// Clean up any incorrect powerPreference values from localStorage
const cleanPowerPreference = (state: PerformanceSettingsState): PerformanceSettingsState => {
    if (state.canvas.powerPreference === 'high-perfomance') {
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

const usePerformanceSettingsStore = create<PerformanceSettingsStore>()(
    persist(
        (set, get) => ({
            ...cleanPowerPreference(initial),

            setPreset: (preset) => set(() => cleanPowerPreference(presets[preset])),
            setDpr: (partial) => set((state) => ({ dpr: { ...state.dpr, ...partial } })),
            setCanvas: (partial) => set((state) => ({ canvas: { ...state.canvas, ...partial } })),
            setPerformance: (partial) => set((state) => ({ performance: { ...state.performance, ...partial } })),
            setAdaptiveEvents: (partial) => set((state) => ({ adaptiveEvents: { ...state.adaptiveEvents, ...partial } })),
            setInteractionDegrade: (partial) => set((state) => ({ interactionDegrade: { ...state.interactionDegrade, ...partial } })),
            reset: () => set(() => cleanPowerPreference(initial)),

            selectCanvasDpr: (opts) => pickDpr(get(), opts),
            selectCanvasProps: (opts) => {
                const s = get();
                return {
                    dpr: pickDpr(s, opts),
                    performance: { ...s.performance }
                };
            },
            selectAdaptiveDprProps: () => {
                const s = get();
                return {
                    enabled: s.dpr.mode === 'adaptive',
                    pixelated: s.dpr.pixelated
                };
            }
        }),
        {
            name: "performance-settings-storage",
            partialize: (s) => ({
                preset: s.preset,
                dpr: s.dpr,
                canvas: s.canvas,
                performance: s.performance,
                adaptiveEvents: s.adaptiveEvents,
                interactionDegrade: s.interactionDegrade
            }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    const cleanedState = cleanPowerPreference(state);
                    if (cleanedState !== state) {
                        set(() => cleanedState);
                    }
                }
            }
        }
    )
);

export default usePerformanceSettingsStore;
