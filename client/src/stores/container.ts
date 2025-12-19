import { create } from 'zustand';
import containerApi from '@/services/api/container';
import { calculatePaginationState, initialListingMeta } from '@/utilities/pagination-utils';

export interface Container {
    _id: string;
    name: string;
    image: string;
    status: string;
    containerId: string;
    team: {
        _id: string;
        name: string;
    };
    createdAt: string;
    ports?: Array<{ public: number; private: number }>;
}

interface ContainerState {
    containers: Container[];
    listingMeta: typeof initialListingMeta;
    isLoading: boolean;
    isFetchingMore: boolean;
    error: string | null;

    fetchContainers: (opts?: {
        page?: number;
        limit?: number;
        search?: string;
        append?: boolean;
        force?: boolean;
    }) => Promise<void>;
}

const useContainerStore = create<ContainerState>((set, get) => ({
    containers: [],
    listingMeta: initialListingMeta,
    isLoading: false,
    isFetchingMore: false,
    error: null,

    fetchContainers: async(opts = {}) => {
        const { page = 1, limit = 20, search = '', append = false } = opts;
        const state = get();

        if(state.isLoading || state.isFetchingMore) return;

        if(append){
            set({ isFetchingMore: true, error: null });
        }else{
            set({ isLoading: true, error: null });
        }

        try{
            const response = await containerApi.getAll({ search, page, limit });

            let newContainers: Container[] = [];

            if(Array.isArray(response)) {
                newContainers = response as unknown as Container[];
            }else if((response as any).data) {
                newContainers = (response as any).data as unknown as Container[];
            }

            const { data, listingMeta } = calculatePaginationState({
                newData: newContainers,
                currentData: state.containers,
                page,
                limit,
                append,
                totalFromApi: undefined, // containerApi doesn't return total
                previousTotal: state.listingMeta.total
            });

            set({
                containers: data,
                listingMeta,
                isLoading: false,
                isFetchingMore: false,
                error: null
            });

        }catch(error: any){
            set({
                isLoading: false,
                isFetchingMore: false,
                error: error.message || 'Failed to fetch containers'
            });
        }
    }
}));

export default useContainerStore;
