import { create } from 'zustand';
import { combineSlices } from '@/shared/presentation/stores/helpers';
import { createTeamSlice, type TeamSlice } from './slice';

export const useTeamStore = create<TeamSlice>()(combineSlices(createTeamSlice));

export { type TeamSlice, type TeamState, type TeamActions } from './slice';
export default useTeamStore;
