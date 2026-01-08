import type { Container } from '@/features/container/types';
import containerApi from '@/features/container/api/container';
import { calculatePaginationState, initialListingMeta, type ListingMeta } from '@/utilities/api/pagination-utils';
import { runRequest } from '../../../stores/helpers';
import type { SliceCreator } from '../../../stores/helpers/create-slice';

export interface ContainerState {
    containers: Container[];
    isLoading: boolean;
    isFetchingMore: boolean;
    error: string | null;
    listingMeta: ListingMeta;
}

export interface ContainerActions {
    fetchContainers: (opts?: { page?: number; limit?: number; search?: string; append?: boolean; force?: boolean }) => Promise<void>;
    resetContainers: () => void;
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



    resetContainers: () => {
        set({
            containers: [],
            listingMeta: initialListingMeta,
            isLoading: false,
            error: null
        } as Partial<ContainerSlice>);
    },

    fetchContainers: async (opts = {}) => {
        const { page = 1, limit = 20, search = '', append = false, force = false } = opts;
        const state = get() as ContainerSlice;

        // Skip if already loading
        if ((append && state.isFetchingMore) || (!append && state.isLoading)) return;

        // Skip if already have containers and not appending/searching
        if (!force && !append && !search && page === 1 && state.containers.length > 0) return;

        await runRequest(set, get, () => containerApi.getAll({ page, limit, search }), {
            loadingKey: append ? 'isFetchingMore' : 'isLoading',
            errorFallback: 'Failed to load containers',
            onSuccess: (response) => {
                const { data, total } = response;
                const { data: newData, listingMeta } = calculatePaginationState({
                    newData: data || [],
                    currentData: state.containers,
                    page, limit, append,
                    totalFromApi: total,
                    previousTotal: state.listingMeta.total
                });
                set({ containers: newData, listingMeta } as Partial<ContainerSlice>);
            }
        });
    }
});
