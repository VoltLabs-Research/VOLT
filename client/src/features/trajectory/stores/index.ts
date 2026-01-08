import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import type { TrajectoryStore } from '@/types/stores/trajectories';
import { createTrajectorySlice } from '@/features/trajectory/stores/slice';

export const useTrajectoryStore = create<TrajectoryStore>()(combineSlices(createTrajectorySlice));

export default useTrajectoryStore;