import type { AnalysisConfig } from '@/features/analysis/types';

export interface AnalysisConfigState {
    analysisConfig: AnalysisConfig | null;
    analysisConfigs: AnalysisConfig[];
    listingMeta: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
    isLoading: boolean;
    isListingLoading: boolean;
    isFetchingMore: boolean;
    error: string | null;
}

export interface AnalysisConfigActions {
    resetAnalysisConfig: () => void;
    resetAnalysisConfigs: () => void;
    getAnalysisConfigs: (teamId: string, opts?: { page?: number; limit?: number; search?: string; append?: boolean; force?: boolean }) => Promise<void>;
    updateAnalysisConfig: (analysis?: AnalysisConfig | null) => void;
    deleteAnalysisConfig: (id: string) => Promise<void>;
}

export type AnalysisConfigStore = AnalysisConfigState & AnalysisConfigActions;
