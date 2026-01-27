import { runRequest } from '@/shared/presentation/stores/helpers';
import { calculatePaginationState, initialListingMeta } from '@/shared/utilities/api/pagination-utils';
import type { ListingMeta } from '@/shared/utilities/api/pagination-utils';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { Container } from '../../domain/entities/Container';
import { containerRepository } from '../../infrastructure/repositories/ContainerRepository';

export interface ContainerState {
    containers: Container[];
    isLoading: boolean;
    isFetchingMore: boolean;
    error: string | null;
    listingMeta: ListingMeta;
}

export interface ContainerActions {
    fetchContainers: (opts?: { page?: number; limit?: number; search?: string; append?: boolean; force?: boolean }) => Promise<void>;
    deleteContainer: (id: string) => Promise<void>;
    controlContainer: (id: string, action: 'start' | 'stop' | 'pause' | 'unpause') => Promise<void>;
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

        await runRequest(set, get, () => containerRepository.getContainers({ page, limit, search }), {
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
    },

    deleteContainer: async (id: string) => {
        await runRequest(set, get, () => containerRepository.deleteContainer(id), {
            loadingKey: 'isLoading',
            errorFallback: 'Failed to delete container',
            rethrow: true,
            successMessage: 'Container deleted successfully',
            onSuccess: () => {
                set((state: ContainerSlice) => ({
                    containers: state.containers.filter((c) => c._id !== id),
                    listingMeta: {
                        ...state.listingMeta,
                        total: state.listingMeta.total - 1
                    }
                }));
            }
        });
    },

    controlContainer: async (id: string, action) => {
        await runRequest(set, get, () => containerRepository.controlContainer(id, action), {
            loadingKey: 'isLoading',
            errorFallback: `Failed to ${action} container`,
            rethrow: true,
            successMessage: `Container ${action}ed successfully`
        });
    }
});
