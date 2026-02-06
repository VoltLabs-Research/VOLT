import { create } from 'zustand';
import type { ListingRow } from '../../domain/entities';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListing';

interface PluginListingState {
    rows: ListingRow[];
    columns: ColumnConfig[];
    setRows: (rows: ListingRow[]) => void;
    appendRows: (rows: ListingRow[]) => void;
    setColumns: (columns: ColumnConfig[]) => void;
    removeRowByAnalysisId: (analysisId: string) => void;
    reset: () => void;
};

const usePluginListingStore = create<PluginListingState>((set) => ({
    rows: [],
    columns: [],
    setRows: (rows) => set({ rows }),
    appendRows: (rows) => set((state) => ({ rows: [...state.rows, ...rows] })),
    setColumns: (columns) => set({ columns }),
    removeRowByAnalysisId: (analysisId) => set((state) => ({
        rows: state.rows.filter((row) => row.analysisId !== analysisId)
    })),
    reset: () => set({ rows: [], columns: [] })
}));

export default usePluginListingStore;
