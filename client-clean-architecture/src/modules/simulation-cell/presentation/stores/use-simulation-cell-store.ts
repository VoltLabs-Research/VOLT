import { create } from 'zustand';
import type { SimulationCell } from '../../domain/entities';

interface SimulationCellStore {
    cells: SimulationCell[];
    isLoading: boolean;
    error: string | null;
    setCells: (items: SimulationCell[]) => void;
    appendCells: (items: SimulationCell[]) => void;
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

const initialState = { cells: [] as SimulationCell[], isLoading: false, error: null as string | null };

const useSimulationCellStore = create<SimulationCellStore>((set) => ({
    ...initialState,
    setCells: (items) => set({ cells: items }),
    appendCells: (items) => set((s) => {
        const ids = new Set(s.cells.map((c) => c._id));
        return { cells: [...s.cells, ...items.filter((c) => !ids.has(c._id))] };
    }),
    setLoading: (value) => set({ isLoading: value }),
    setError: (error) => set({ error }),
    reset: () => set(initialState)
}));

export default useSimulationCellStore;
