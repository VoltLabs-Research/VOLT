import { create } from 'zustand';

import type { CellPbc } from '@/modules/fractal/utilities/cell-wireframe';

// A client-side cell edit: absolute edge vectors + origin + per-axis PBC. Mirrors
// the SimulationCell geometry shape but is the locally-edited override that the
// 3D wireframe renders. Trajectory-scoped (one cell applies to all frames; per
// 14-particle-geometry-cell v1 scope).
export interface EditableCell {
    cellVectors: number[][];
    cellOrigin: number[];
    pbc: CellPbc;
}

interface CellDisplayStore {
    // Draw neighbouring periodic copies of the cell wireframe along enabled PBC axes.
    showPbcImages: boolean;
    // Per-trajectory edited cell. Absent → the wireframe uses the fetched cell.
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
            cellOverrides: { ...state.cellOverrides, [trajectoryId]: cell }
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
