import { create } from 'zustand';
import type { ListingRow } from '../../domain/entities';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';

interface SubListingParams {
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
}

interface PluginListingState {
    rows: ListingRow[];
    columns: ColumnConfig[];
    subListingNames: string[];
    subListingParams: SubListingParams | null;
    setRows: (rows: ListingRow[]) => void;
    appendRows: (rows: ListingRow[]) => void;
    setColumns: (columns: ColumnConfig[]) => void;
    setSubListingNames: (names: string[]) => void;
    setSubListingParams: (params: SubListingParams | null) => void;
    removeRowByAnalysisId: (analysisId: string) => void;
    reset: () => void;
}

const usePluginListingStore = create<PluginListingState>((set) => ({
    rows: [],
    columns: [],
    subListingNames: [],
    subListingParams: null,
    setRows: (rows) => set({ rows }),
    appendRows: (rows) => set((state) => ({ rows: [...state.rows, ...rows] })),
    setColumns: (columns) => set({ columns }),
    setSubListingNames: (subListingNames) => set({ subListingNames }),
    setSubListingParams: (subListingParams) => set({ subListingParams }),
    removeRowByAnalysisId: (analysisId) => set((state) => ({
        rows: state.rows.filter((row) => row.analysisId !== analysisId)
    })),
    reset: () => set({
        rows: [],
        columns: [],
        subListingNames: [],
        subListingParams: null
    })
}));

export default usePluginListingStore;
