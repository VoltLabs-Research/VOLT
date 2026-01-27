import { simulationCellRepository } from '../../infrastructure/repositories/SimulationCellRepository';
import { runRequest } from '@/shared/presentation/stores/helpers';
import { calculatePaginationState, initialListingMeta } from '@/shared/utilities/api/pagination-utils';
import type { ListingMeta } from '@/shared/utilities/api/pagination-utils';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { SimulationCell } from '../../domain/entities/SimulationCell';

export interface SimulationCellState {
    simulationCells: SimulationCell[];
    isLoading: boolean;
    isFetchingMore: boolean;
    error: string | null;
    listingMeta: ListingMeta;
}

export interface SimulationCellActions {
    fetchSimulationCells: (teamId: string, opts?: { page?: number; limit?: number; search?: string; append?: boolean }) => Promise<void>;
    resetSimulationCells: () => void;
}

export type SimulationCellSlice = SimulationCellState & SimulationCellActions;

export const initialState: SimulationCellState = {
    simulationCells: [],
    isLoading: false,
    isFetchingMore: false,
    error: null,
    listingMeta: initialListingMeta
};

export const createSimulationCellSlice: SliceCreator<SimulationCellSlice> = (set, get) => ({
    ...initialState,

    resetSimulationCells: () => {
        set({
            simulationCells: [],
            listingMeta: initialListingMeta,
            isLoading: false,
            error: null
        });
    },

    fetchSimulationCells: async (teamId, opts = {}) => {
        const { page = 1, limit = 20, search = '', append = false } = opts;
        const state = get() as SimulationCellSlice;

        if ((append && state.isFetchingMore) || (!append && state.isLoading)) return;

        await runRequest(set, get, () => simulationCellRepository.getAll(teamId, { page, limit, search }), {
            loadingKey: append ? 'isFetchingMore' : 'isLoading',
            errorFallback: 'Failed to load simulation cells',
            onSuccess: (apiResponse) => {
                const paginationResult = calculatePaginationState({
                    newData: apiResponse.data,
                    currentData: state.simulationCells,
                    page,
                    limit,
                    append,
                    totalFromApi: apiResponse.results.total,
                    previousTotal: state.listingMeta.total
                });

                set({
                    simulationCells: paginationResult.data,
                    listingMeta: paginationResult.listingMeta,
                    error: null
                });
            }
        });
    }
});
