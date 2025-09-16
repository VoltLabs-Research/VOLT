import { create } from 'zustand';
import { api } from '@/services/api';
import { createAsyncAction } from '@/utilities/asyncAction';
import type { ApiResponse } from '@/types/api';
import type { DislocationState, DislocationStore, DislocationsResponse } from '@/types/stores/dislocations';

const initialState: DislocationState = {
    dislocations: [],
    isLoading: false,
    error: null,

    page: 1,
    limit: 100,
    total: 0,
    sort: '-createdAt',

    totals: { segments: 0, points: 0, length: 0 },
    filters: {}
};

const useDislocationStore = create<DislocationStore>()((set, get) => {
    const asyncAction = createAsyncAction(set, get);

    return {
        ...initialState,

        getUserDislocations: (overrides = {}) => {
            const { page, limit, sort, ...extra } = overrides;
            const nextPage = page ?? get().page;
            const nextLimit = limit ?? get().limit;
            const nextSort = sort ?? get().sort;
            const nextFilters = { ...get().filters, ...extra };

            // Persist local state for pagination/filters
            set({
                page: nextPage,
                limit: nextLimit,
                sort: nextSort,
                filters: nextFilters
            });

            return asyncAction(() => api.get<ApiResponse<DislocationsResponse>>('/dislocations', {
                params: {
                    ...nextFilters,
                    page: nextPage,
                    limit: nextLimit,
                    sort: nextSort
                }
            }), {
                loadingKey: 'isLoading',
                onSuccess: (res) => {
                    const payload = res.data.data;
                    return {
                        dislocations: payload.dislocations,
                        total: payload.total,
                        totals: payload.totals,
                        page: payload.page,
                        limit: payload.limit,
                        error: null
                    };
                },
                onError: (error) => ({
                    error: error?.response?.data?.message || 'Failed to load dislocations'
                })
                }
            );
        },

        clearError: () => set({ error: null }),

        reset: () => set(initialState)
    };
});

export default useDislocationStore;
