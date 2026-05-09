import type {
    AdaptiveDprProps,
    AdaptiveEventsSettings,
    CanvasPerformanceProp,
    CanvasRuntimeResolutionOptions,
    DprSettings,
    InteractionDegradeSettings,
    PerformancePreset,
    PerformanceSettingsState,
    ResolvedCanvasRuntimeProps
} from '@/shared/domain/rendering/performance';

export interface PerformanceSettingsActions {
    setPreset: (preset: PerformancePreset) => void;
    setDpr: (partial: Partial<DprSettings>) => void;
    setPerformance: (partial: Partial<CanvasPerformanceProp>) => void;
    setAdaptiveEvents: (partial: Partial<AdaptiveEventsSettings>) => void;
    setInteractionDegrade: (partial: Partial<InteractionDegradeSettings>) => void;
    reset: () => void;
    selectCanvasDpr: (opts: CanvasRuntimeResolutionOptions) => number | [number, number];
    selectCanvasProps: (opts: CanvasRuntimeResolutionOptions) => ResolvedCanvasRuntimeProps;
    selectAdaptiveDprProps: () => AdaptiveDprProps;
}

export type PerformanceSettingsStore = PerformanceSettingsState & PerformanceSettingsActions;
