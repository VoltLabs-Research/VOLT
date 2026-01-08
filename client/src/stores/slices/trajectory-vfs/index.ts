import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createTrajectoryVfsSlice, type TrajectoryVfsSlice } from '@/stores/slices/trajectory-vfs/vfs-slice';

export const useTrajectoryVfsStore = create<TrajectoryVfsSlice>()(combineSlices(createTrajectoryVfsSlice));

export { type TrajectoryVfsSlice, type TrajectoryVfsState, type TrajectoryVfsActions, type FsEntry } from '@/stores/slices/trajectory-vfs/vfs-slice';
export default useTrajectoryVfsStore;
