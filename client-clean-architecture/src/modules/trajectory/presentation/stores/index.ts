import { create } from 'zustand';
import { createTrajectorySlice } from './slice';
import type { TrajectorySlice } from './slice';
import { createTrajectoryVfsSlice } from './vfs-slice';
import type { TrajectoryVfsSlice } from './vfs-slice';

export const useTrajectoryStore = create<TrajectorySlice>()((...a) => ({
    ...createTrajectorySlice(...a)
}));

export const useTrajectoryFS = create<TrajectoryVfsSlice>()((...a) => ({
    ...createTrajectoryVfsSlice(...a)
}));

export { createTrajectorySlice } from './slice';
export type { TrajectorySlice } from './slice';
export { createTrajectoryVfsSlice } from './vfs-slice';
export type { TrajectoryVfsSlice } from './vfs-slice';
