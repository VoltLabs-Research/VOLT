import type { AnalysisConfigStore } from '@/types/stores/analysis-config';
import analysisConfigApi from '@/services/api/analysis/analysis';
import { calculatePaginationState, initialListingMeta } from '@/utilities/api/pagination-utils';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

const initialState = {
    analysisConfig: null,
    analysisConfigs: [],
    listingMeta: initialListingMeta,
    isLoading: false,
    isFetchingMore: false,
    isListingLoading: false,
    error: null,
    getAnalysisConfigs: async () => { },
    deleteAnalysisConfig: async () => { },
};

export const createAnalysisConfigSlice: SliceCreator<AnalysisConfigStore> = (set, get) => ({
    ...initialState,

    getAnalysisConfigs: async (teamId, options = {}) => {
        if (!teamId) {
            throw new Error('No team ID provided');
        }

        const page = options.page ?? 1;
        const limit = options.limit ?? 20;
        const searchQuery = options.search ?? '';
        const shouldAppend = options.append ?? false;

        const storeSnapshot = get();

        // Skip if already have configs (initial load only)
        if (!shouldAppend && !searchQuery && page === 1 && storeSnapshot.analysisConfigs.length > 0) {
            return;
        }

        if (shouldAppend && storeSnapshot.isFetchingMore) {
            return;
        }

        const request = () => {
            return analysisConfigApi.getByTeamId({
                page,
                limit,
                q: searchQuery
            });
        };

        await runRequest(set, get, request, {
            loadingKey: shouldAppend ? 'isFetchingMore' : 'isListingLoading',
            errorFallback: 'Failed to load analysis configs',
            onSuccess: (apiResponse) => {
                const paginationResult = calculatePaginationState({
                    newData: apiResponse.data,
                    currentData: storeSnapshot.analysisConfigs,
                    page,
                    limit,
                    append: shouldAppend,
                    totalFromApi: apiResponse.results.total,
                    previousTotal: storeSnapshot.listingMeta.total
                });

                set({
                    analysisConfigs: paginationResult.data,
                    listingMeta: paginationResult.listingMeta,
                    error: null
                });
            }
        });
    },

    updateAnalysisConfig: (config) => {
        set({ analysisConfig: config ?? null });
    },

    deleteAnalysisConfig: async (id: string) => {
        await runRequest(set, get, () => analysisConfigApi.delete(id), {
            loadingKey: 'isLoading',
            errorFallback: 'Failed to delete analysis config',
            rethrow: true,
            successMessage: 'Analysis config deleted successfully',
            onSuccess: () => {
                set((state: AnalysisConfigStore) => ({
                    analysisConfigs: state.analysisConfigs.filter((c) => c._id !== id),
                    listingMeta: {
                        ...state.listingMeta,
                        total: state.listingMeta.total - 1
                    }
                }));
            }
        });
    },

    resetAnalysisConfig: () => {
        set({ analysisConfig: null });
    },
});
