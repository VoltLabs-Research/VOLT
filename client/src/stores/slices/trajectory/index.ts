import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import type { TrajectoryStore } from '@/types/stores/trajectories';
import { createTrajectorySlice, dataURLToBlob, dataURLToObjectURL } from './trajectory-slice';

export const useTrajectoryStore = create<TrajectoryStore>()(combineSlices(createTrajectorySlice));

export { dataURLToBlob, dataURLToObjectURL };
export default useTrajectoryStore;
