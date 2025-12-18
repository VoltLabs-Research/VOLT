import type { Analysis } from '@/types/models';

export interface AnalysisConfigState {
    analysisConfig: Analysis | null;
    analysisConfigs: Analysis[];
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
    dislocationsLoading: boolean;
    analysisDislocationsById: Record<string, any[]>;
    dislocationsLoadingById: Record<string, boolean>;
}

export interface AnalysisConfigActions {
    setIsLoading: (loading: boolean) => void;
    resetAnalysisConfig: () => void;
    getDislocationsByAnalysisId: (analysisId: string) => void;
    getAnalysisConfigs: (teamId: string, opts?: { page?: number; limit?: number; search?: string; append?: boolean; force?: boolean }) => Promise<void>;
    updateAnalysisConfig: (analysis?: Analysis | null) => void;
}

export type AnalysisConfigStore = AnalysisConfigState & AnalysisConfigActions;
