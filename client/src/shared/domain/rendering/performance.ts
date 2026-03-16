import type { RenderingOption } from '@/shared/domain/rendering/renderer';

export interface DprSettings {
    mode: DprMode;
    fixed: number;
    min: number;
    max: number;
    pixelated: boolean;
    snap: boolean;
    interactionMin: number;
};

export interface CanvasPerformanceProp {
    current: number;
    min: number;
    max: number;
    debounce: number;
};

export interface AdaptiveEventsSettings {
    enabled: boolean;
};

export interface InteractionDegradeSettings {
    enabled: boolean;
    debounceMs: number;
};

export interface PerformanceSettingsState {
    preset: PerformancePreset;
    dpr: DprSettings;
    performance: CanvasPerformanceProp;
    adaptiveEvents: AdaptiveEventsSettings;
    interactionDegrade: InteractionDegradeSettings;
};

export interface PerformancePresetDefinition {
    label: string;
    powerPreference: PowerPreference;
    settings: PerformanceSettingsState;
};

export interface CanvasRuntimeResolutionOptions {
    interacting?: boolean;
    boostScreenshot?: boolean;
};

export interface CanvasRuntimeInteractionSource {
    interactionDegradeEnabled: boolean;
};

export interface CanvasRuntimeSource extends CanvasRuntimeInteractionSource {
    dpr: DprSettings;
    performance: CanvasPerformanceProp;
};

export interface AdaptiveDprProps {
    enabled: boolean;
    pixelated: boolean;
};

export interface ResolvedCanvasRuntimeProps {
    dpr: number | [number, number];
    performance: CanvasPerformanceProp;
};

export type PerformancePresetOption = RenderingOption<PerformancePreset>;

export type PowerPreferenceOption = RenderingOption<PowerPreference>;

export enum DprMode {
    Fixed = 'fixed',
    Adaptive = 'adaptive'
};

export enum PerformancePreset {
    Ultra = 'ultra',
    High = 'high',
    Balanced = 'balanced',
    Performance = 'performance',
    Battery = 'battery'
};

export enum PowerPreference {
    Default = 'default',
    HighPerformance = 'high-performance',
    LowPower = 'low-power'
};

export const PERFORMANCE_PRESET_ORDER: PerformancePreset[] = [
    PerformancePreset.Ultra,
    PerformancePreset.High,
    PerformancePreset.Balanced,
    PerformancePreset.Performance,
    PerformancePreset.Battery
];

export const POWER_PREFERENCE_OPTIONS: PowerPreferenceOption[] = [
    { title: 'Default', value: PowerPreference.Default },
    { title: 'High Performance', value: PowerPreference.HighPerformance },
    { title: 'Low Power', value: PowerPreference.LowPower }
];

export const PERFORMANCE_PRESET_REGISTRY: Record<PerformancePreset, PerformancePresetDefinition> = {
    [PerformancePreset.Ultra]: {
        label: 'Ultra',
        powerPreference: PowerPreference.HighPerformance,
        settings: {
            preset: PerformancePreset.Ultra,
            dpr: {
                mode: DprMode.Adaptive,
                fixed: 2,
                min: 1.5,
                max: 2,
                pixelated: false,
                snap: true,
                interactionMin: 1.25
            },
            performance: {
                current: 1,
                min: 0.7,
                max: 1,
                debounce: 30
            },
            adaptiveEvents: {
                enabled: false
            },
            interactionDegrade: {
                enabled: true,
                debounceMs: 100
            }
        }
    },
    [PerformancePreset.High]: {
        label: 'High',
        powerPreference: PowerPreference.HighPerformance,
        settings: {
            preset: PerformancePreset.High,
            dpr: {
                mode: DprMode.Adaptive,
                fixed: 1.5,
                min: 1.25,
                max: 1.75,
                pixelated: false,
                snap: true,
                interactionMin: 1
            },
            performance: {
                current: 1,
                min: 0.5,
                max: 1,
                debounce: 50
            },
            adaptiveEvents: {
                enabled: false
            },
            interactionDegrade: {
                enabled: true,
                debounceMs: 120
            }
        }
    },
    [PerformancePreset.Balanced]: {
        label: 'Balanced',
        powerPreference: PowerPreference.Default,
        settings: {
            preset: PerformancePreset.Balanced,
            dpr: {
                mode: DprMode.Adaptive,
                fixed: 1.25,
                min: 1,
                max: 1.5,
                pixelated: true,
                snap: true,
                interactionMin: 0.9
            },
            performance: {
                current: 0.9,
                min: 0.4,
                max: 1,
                debounce: 60
            },
            adaptiveEvents: {
                enabled: true
            },
            interactionDegrade: {
                enabled: true,
                debounceMs: 120
            }
        }
    },
    [PerformancePreset.Performance]: {
        label: 'Performance',
        powerPreference: PowerPreference.HighPerformance,
        settings: {
            preset: PerformancePreset.Performance,
            dpr: {
                mode: DprMode.Adaptive,
                fixed: 1,
                min: 0.75,
                max: 1.25,
                pixelated: true,
                snap: true,
                interactionMin: 0.75
            },
            performance: {
                current: 0.8,
                min: 0.3,
                max: 1,
                debounce: 80
            },
            adaptiveEvents: {
                enabled: true
            },
            interactionDegrade: {
                enabled: true,
                debounceMs: 120
            }
        }
    },
    [PerformancePreset.Battery]: {
        label: 'Battery Saver',
        powerPreference: PowerPreference.LowPower,
        settings: {
            preset: PerformancePreset.Battery,
            dpr: {
                mode: DprMode.Fixed,
                fixed: 1,
                min: 0.75,
                max: 1,
                pixelated: true,
                snap: true,
                interactionMin: 0.75
            },
            performance: {
                current: 0.7,
                min: 0.25,
                max: 1,
                debounce: 120
            },
            adaptiveEvents: {
                enabled: true
            },
            interactionDegrade: {
                enabled: true,
                debounceMs: 150
            }
        }
    }
};

export const PERFORMANCE_PRESET_OPTIONS: PerformancePresetOption[] = PERFORMANCE_PRESET_ORDER.map((preset) => ({
    title: PERFORMANCE_PRESET_REGISTRY[preset].label,
    value: preset
}));

export const DEFAULT_PERFORMANCE_PRESET = PerformancePreset.Battery;

const clonePerformanceSettings = (state: PerformanceSettingsState): PerformanceSettingsState => ({
    preset: state.preset,
    dpr: { ...state.dpr },
    performance: { ...state.performance },
    adaptiveEvents: { ...state.adaptiveEvents },
    interactionDegrade: { ...state.interactionDegrade }
});

/** Returns the canonical display label for a performance preset. */
export const getPerformancePresetLabel = (preset: PerformancePreset): string => PERFORMANCE_PRESET_REGISTRY[preset].label;

/** Returns a cloned preset configuration so callers can safely mutate local state. */
export const getPerformancePresetState = (preset: PerformancePreset): PerformanceSettingsState => {
    return clonePerformanceSettings(PERFORMANCE_PRESET_REGISTRY[preset].settings);
};

/** Returns the renderer power preference owned by a performance preset. */
export const getPerformancePresetPowerPreference = (preset: PerformancePreset): PowerPreference => {
    return PERFORMANCE_PRESET_REGISTRY[preset].powerPreference;
};

/** Checks whether a runtime string matches a supported performance preset. */
export const isPerformancePreset = (value: string): value is PerformancePreset => {
    return PERFORMANCE_PRESET_ORDER.some((preset) => preset === value);
};

/** Checks whether a runtime string matches a supported WebGL power preference. */
export const isPowerPreference = (value: string): value is PowerPreference => {
    return POWER_PREFERENCE_OPTIONS.some((option) => option.value === value);
};

/** Ensures a persisted performance state remains isolated from preset registry references. */
export const getValidatedPerformanceSettingsState = (state: PerformanceSettingsState): PerformanceSettingsState => {
    return clonePerformanceSettings(state);
};

/** Resolves the runtime DPR value used by the canvas for the current interaction state. */
export const resolveCanvasDpr = (
    settings: Pick<CanvasRuntimeSource, 'dpr'> & CanvasRuntimeInteractionSource,
    options: CanvasRuntimeResolutionOptions
): number | [number, number] => {
    const { dpr } = settings;
    if (options.boostScreenshot) {
        return [dpr.max, dpr.max];
    }

    if (dpr.mode === DprMode.Fixed) {
        return dpr.fixed;
    }

    let min = dpr.min;
    if (options.interacting && settings.interactionDegradeEnabled) {
        min = Math.min(dpr.interactionMin, dpr.min);
    }

    return [min, dpr.max];
};

/** Resolves the runtime canvas DPR and performance props from a performance state snapshot. */
export const resolveCanvasRuntimeProps = (
    settings: CanvasRuntimeSource,
    options: CanvasRuntimeResolutionOptions
): ResolvedCanvasRuntimeProps => ({
    dpr: resolveCanvasDpr(settings, options),
    performance: settings.performance
});

/** Resolves the AdaptiveDpr component props from a performance state snapshot. */
export const resolveAdaptiveDprProps = (settings: Pick<CanvasRuntimeSource, 'dpr'>): AdaptiveDprProps => ({
    enabled: settings.dpr.mode === DprMode.Adaptive,
    pixelated: settings.dpr.pixelated
});
