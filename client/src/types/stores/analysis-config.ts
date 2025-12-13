import type { Analysis } from '@/types/models';

export interface AnalysisConfigState{
    analysisConfig: Analysis | null;
    isLoading: boolean;
    error: string | null;
    dislocationsLoading: boolean;
    analysisDislocationsById: Record<string, any[]>;
    dislocationsLoadingById: Record<string, boolean>;
}

export interface AnalysisConfigActions{
    setIsLoading: (loading: boolean) => void;
    resetAnalysisConfig: () => void;
    getDislocationsByAnalysisId: (analysisId: string) => void;
    updateAnalysisConfig: (analysis?: Analysis | null) => void;
}

export type AnalysisConfigStore = AnalysisConfigState & AnalysisConfigActions;
