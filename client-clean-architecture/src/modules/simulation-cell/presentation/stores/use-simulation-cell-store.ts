import { create } from 'zustand';
import type { SimulationCell } from '../../domain/entities';

interface SimulationCellState {
    simulationCells: SimulationCell[];
    isLoading: boolean;
    error: string | null;
};

interface SimulationCellActions {
    setSimulationCells: (items: SimulationCell[]) => void;
    appendSimulationCells: (items: SimulationCell[]) => void;
    setLoading: (value: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;
};

type SimulationCellStore = SimulationCellState & SimulationCellActions;

const initialState: SimulationCellState = {
    simulationCells: [],
    isLoading: false,
    error: null
};

const useSimulationCellStore = create<SimulationCellStore>((set) => ({
    ...initialState,

    setSimulationCells: (items) => set({ simulationCells: items }),

    appendSimulationCells: (items) => set((state) => {
        const existingIds = new Set(state.simulationCells.map((s) => s._id));
        const uniqueNewItems = items.filter((s) => !existingIds.has(s._id));
        return {
            simulationCells: [...state.simulationCells, ...uniqueNewItems]
        };
    }),

    setLoading: (value) => set({ isLoading: value }),

    setError: (error) => set({ error }),

    reset: () => set(initialState)
}));

export default useSimulationCellStore;
