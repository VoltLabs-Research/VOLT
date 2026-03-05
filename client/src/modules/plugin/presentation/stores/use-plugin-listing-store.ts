import { create } from 'zustand';
import type { ListingRow } from '../../domain/entities';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';
import type { GetSubListingOutputDTO } from '../../application/dtos';

interface PluginListingState {
    rows: ListingRow[];
    columns: ColumnConfig[];
    subListingNames: string[];
    subListingData: GetSubListingOutputDTO | null;
    isSubListingLoading: boolean;
    setRows: (rows: ListingRow[]) => void;
    appendRows: (rows: ListingRow[]) => void;
    setColumns: (columns: ColumnConfig[]) => void;
    setSubListingNames: (names: string[]) => void;
    setSubListingData: (data: GetSubListingOutputDTO | null) => void;
    setSubListingLoading: (loading: boolean) => void;
    removeRowByAnalysisId: (analysisId: string) => void;
    reset: () => void;
};

const usePluginListingStore = create<PluginListingState>((set) => ({
    rows: [],
    columns: [],
    subListingNames: [],
    subListingData: null,
    isSubListingLoading: false,
    setRows: (rows) => set({ rows }),
    appendRows: (rows) => set((state) => ({ rows: [...state.rows, ...rows] })),
    setColumns: (columns) => set({ columns }),
    setSubListingNames: (subListingNames) => set({ subListingNames }),
    setSubListingData: (subListingData) => set({ subListingData }),
    setSubListingLoading: (isSubListingLoading) => set({ isSubListingLoading }),
    removeRowByAnalysisId: (analysisId) => set((state) => ({
        rows: state.rows.filter((row) => row.analysisId !== analysisId)
    })),
    reset: () => set({
        rows: [],
        columns: [],
        subListingNames: [],
        subListingData: null,
        isSubListingLoading: false
    })
}));

export default usePluginListingStore;
