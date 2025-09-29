export type PerformancePreset = 'ultra' | 'high' | 'balanced' | 'perfomance' | 'battery';
export type PowerPreference = 'default' | 'high-performance' | 'low-power';

export interface DprSettings {
    mode: 'fixed' | 'adaptive';
    fixed: number;
    min: number;
    max: number;
    pixelated: boolean;
    snap: boolean;
    interactionMin: number;
}

export interface CanvasPerformanceProp {
    current: number;
    min: number;
    max: number;
    debounce: number;
}

export interface CanvasSettings{
    powerPreference: PowerPreference;
}

export interface AdaptiveEventsSettings {
    enabled: boolean;
}

export interface InteractionDegradeSettings{
    enabled: boolean;
    debounceMs: number;
}

export interface PerformanceSettingsState{
    preset: PerformancePreset;
    dpr: DprSettings;
    canvas: CanvasSettings;
    performance: CanvasPerformanceProp;
    adaptiveEvents: AdaptiveEventsSettings;
    interactionDegrade: InteractionDegradeSettings;
}

export interface PerformanceSettingsActions{
    setPreset: (preset: PerformancePreset) => void;
    setDpr: (partial: Partial<DprSettings>) => void;
    setCanvas: (partial: Partial<CanvasSettings>) => void;
    setPerformance: (partial: Partial<CanvasPerformanceProp>) => void;
    setAdaptiveEvents: (partial: Partial<AdaptiveEventsSettings>) => void;
    setInteractionDegrade: (partial: Partial<InteractionDegradeSettings>) => void;
    reset: () => void;

    selectCanvasDpr: (opts: { interacting?: boolean; boostScreenshot?: boolean }) => number | [number, number];
    selectCanvasProps: (opts: { interacting?: boolean; boostScreenshot?: boolean }) => {
        dpr: number | [number, number];
        performance: CanvasPerformanceProp;
    };
    selectAdaptiveDprProps: (opts: { interacting?: boolean; boostScreenshot?: boolean }) => {
        enabled: boolean;
        pixelated: boolean;
    };
}

export type PerformanceSettingsStore = PerformanceSettingsState & PerformanceSettingsActions;