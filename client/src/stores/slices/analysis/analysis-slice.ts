import type { Analysis } from '@/types/models';
import type { AnalysisConfigStore } from '@/types/stores/analysis-config';
import analysisConfigApi from '@/services/api/analysis/analysis';
import { calculatePaginationState, initialListingMeta } from '@/utilities/api/pagination-utils';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

export interface ExtendedAnalysisStore extends AnalysisConfigStore {
    analysisDislocationsById: Record<string, any[]>;
    dislocationsLoadingById: Record<string, boolean>;
    getDislocationsByAnalysisId: (analysisId: string) => Promise<void>;
}

export const initialState = {
    analysisConfig: null as Analysis | null,
    analysisConfigs: [] as Analysis[],
    listingMeta: initialListingMeta,
    isLoading: true,
    isFetchingMore: false,
    isListingLoading: false,
    error: null as string | null,
    dislocationsLoading: false,
    analysisDislocationsById: {} as Record<string, any[]>,
    dislocationsLoadingById: {} as Record<string, boolean>
};

export const createAnalysisConfigSlice: SliceCreator<ExtendedAnalysisStore> = (set, get) => ({
    ...initialState,

    getAnalysisConfigs: async (teamId, opts = {}) => {
        const { page = 1, limit = 20, search = '', append = false } = opts;
        if (!teamId) throw new Error('No team ID provided');
        const s = get() as ExtendedAnalysisStore;
        if (append && s.isFetchingMore) return;

        await runRequest(set, get, () => analysisConfigApi.getByTeamId({ page, limit, q: search }), {
            loadingKey: append ? 'isFetchingMore' : 'isListingLoading',
            errorFallback: 'Failed to load analysis configs',
            onSuccess: (data) => {
                const { data: analysisConfigs, listingMeta } = calculatePaginationState({
                    newData: (data.configs || []) as unknown as Analysis[],
                    currentData: s.analysisConfigs, page, limit, append,
                    totalFromApi: data.total, previousTotal: s.listingMeta.total
                });
                set({ analysisConfigs, listingMeta, error: null } as Partial<ExtendedAnalysisStore>);
            }
        });
    },

    getDislocationsByAnalysisId: async (analysisId) => {
        set((s: ExtendedAnalysisStore) => ({ dislocationsLoading: true, dislocationsLoadingById: { ...s.dislocationsLoadingById, [analysisId]: true } }));
        await runRequest(set, get, () => analysisConfigApi.getDislocations(analysisId), {
            skipLoading: true,
            onSuccess: (res) => set((s: ExtendedAnalysisStore) => ({
                analysisDislocationsById: { ...s.analysisDislocationsById, [analysisId]: res ?? [] },
                dislocationsLoadingById: { ...s.dislocationsLoadingById, [analysisId]: false },
                dislocationsLoading: false
            })),
            onError: () => set((s: ExtendedAnalysisStore) => ({
                analysisDislocationsById: { ...s.analysisDislocationsById, [analysisId]: [] },
                dislocationsLoadingById: { ...s.dislocationsLoadingById, [analysisId]: false },
                dislocationsLoading: false
            }))
        });
    },

    updateAnalysisConfig: (config) => set({ analysisConfig: config ?? null } as Partial<ExtendedAnalysisStore>),
    resetAnalysisConfig: () => set({ analysisConfig: null } as Partial<ExtendedAnalysisStore>),
    setIsLoading: (loading) => set({ isLoading: loading } as Partial<ExtendedAnalysisStore>)
});
