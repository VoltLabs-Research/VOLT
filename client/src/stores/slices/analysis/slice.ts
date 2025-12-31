import type { AnalysisConfigStore } from '@/types/stores/analysis-config';
import analysisConfigApi from '@/services/api/analysis/analysis';
import { calculatePaginationState, initialListingMeta } from '@/utilities/api/pagination-utils';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

const initialState = {
    analysisConfig: null,
    analysisConfigs: [],
    listingMeta: initialListingMeta,
    isLoading: true,
    isFetchingMore: false,
    isListingLoading: true,
    error: null,
    getAnalysisConfigs: async () => {},
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

    resetAnalysisConfig: () => {
        set({ analysisConfig: null });
    },
});
