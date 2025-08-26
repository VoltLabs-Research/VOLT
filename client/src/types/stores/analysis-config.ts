import type { AnalysisConfig } from '@/types/models';

export interface AnalysisConfigState{
    analysisConfig: AnalysisConfig,
    isLoading: boolean;
}

export interface AnalysisConfigActions{
    setIsLoading: (loading: boolean) => void;
    resetAnalysisConfig: () => void;
    updateAnalysisConfig: (config: Partial<AnalysisConfig>) => void;
    setAnalysisConfig: <K extends keyof AnalysisConfig>(
        key: K,
        value: AnalysisConfig[K]
    ) => void;
}

export type AnalysisConfigStore = AnalysisConfigState & AnalysisConfigActions;