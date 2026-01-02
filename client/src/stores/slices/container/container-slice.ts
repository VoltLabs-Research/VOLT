import type { Container, ListingMeta } from '@/types/models';
import containerApi from '@/services/api/container/container';
import { calculatePaginationState, initialListingMeta } from '@/utilities/api/pagination-utils';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

export interface ContainerState {
    containers: Container[];
    isLoading: boolean;
    isFetchingMore: boolean;
    error: string | null;
    listingMeta: ListingMeta;
}

export interface ContainerActions {
    fetchContainers: (opts?: { page?: number; limit?: number; search?: string; append?: boolean }) => Promise<void>;
}

export type ContainerSlice = ContainerState & ContainerActions;

export const initialState: ContainerState = {
    containers: [],
    isLoading: false,
    isFetchingMore: false,
    error: null,
    listingMeta: initialListingMeta
};

export const createContainerSlice: SliceCreator<ContainerSlice> = (set, get) => ({
    ...initialState,

    fetchContainers: async (opts = {}) => {
        const { page = 1, limit = 20, search = '', append = false } = opts;
        const state = get() as ContainerSlice;
        
        // Skip if already loading
        if ((append && state.isFetchingMore) || (!append && state.isLoading)) return;
        
        // Skip if already have containers and not appending/searching
        if (!append && !search && page === 1 && state.containers.length > 0) return;

        await runRequest(set, get, () => containerApi.getAll({ page, limit, q: search }), {
            loadingKey: append ? 'isFetchingMore' : 'isLoading',
            errorFallback: 'Failed to load containers',
            onSuccess: (response) => {
                const { data, listingMeta } = calculatePaginationState({
                    newData: response || [],
                    currentData: state.containers,
                    page, limit, append,
                    totalFromApi: response.total,
                    previousTotal: state.listingMeta.total
                });
                set({ containers: data, listingMeta } as Partial<ContainerSlice>);
            }
        });
    }
});
