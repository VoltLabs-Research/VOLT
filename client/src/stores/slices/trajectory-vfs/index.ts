import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createTrajectoryVfsSlice, type TrajectoryVfsSlice } from './vfs-slice';

export const useTrajectoryVfsStore = create<TrajectoryVfsSlice>()(combineSlices(createTrajectoryVfsSlice));

export { type TrajectoryVfsSlice, type TrajectoryVfsState, type TrajectoryVfsActions, type FsEntry } from './vfs-slice';
export default useTrajectoryVfsStore;
