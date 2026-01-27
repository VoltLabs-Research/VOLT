import { create } from 'zustand';
import { createSimulationCellSlice } from './slice';
import type { SimulationCellSlice } from './slice';

export const useSimulationCellStore = create<SimulationCellSlice>()((set, get, store) => ({
    ...createSimulationCellSlice(set, get, store)
}));

export type { SimulationCellSlice, SimulationCellState, SimulationCellActions } from './slice';
export default useSimulationCellStore;
