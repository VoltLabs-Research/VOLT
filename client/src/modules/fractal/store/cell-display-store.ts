import { create } from 'zustand';

import type { CellPbc } from '@/modules/fractal/utils/cell-wireframe';

export interface EditableCell {
    cellVectors: number[][];
    cellOrigin: number[];
    pbc: CellPbc;
}

interface CellDisplayStore {
    showPbcImages: boolean;
    cellOverrides: Record<string, EditableCell | undefined>;
    setShowPbcImages: (show: boolean) => void;
    setCellOverride: (trajectoryId: string, cell: EditableCell) => void;
    clearCellOverride: (trajectoryId: string) => void;
    getCellOverride: (trajectoryId: string | undefined) => EditableCell | undefined;
}

export const useCellDisplayStore = create<CellDisplayStore>((set, get) => ({
    showPbcImages: false,
    cellOverrides: {},

    setShowPbcImages: (showPbcImages) => set({ showPbcImages }),

    setCellOverride: (trajectoryId, cell) =>
        set((state) => ({
            cellOverrides: {
                ...state.cellOverrides,
                [trajectoryId]: cell
            }
        })),

    clearCellOverride: (trajectoryId) =>
        set((state) => {
            if (!(trajectoryId in state.cellOverrides)) return state;
            const next = { ...state.cellOverrides };
            delete next[trajectoryId];
            return { cellOverrides: next };
        }),

    getCellOverride: (trajectoryId) =>
        trajectoryId ? get().cellOverrides[trajectoryId] : undefined
}));
