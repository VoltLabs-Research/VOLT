import { create } from 'zustand';
import { combineSlices } from '@/shared/presentation/stores/helpers';
import { createTeamRoleSlice, type TeamRoleSlice } from './slice';

export const useTeamRoleStore = create<TeamRoleSlice>()(combineSlices(createTeamRoleSlice));

export { type TeamRoleSlice, type TeamRoleState, type TeamRoleActions } from './slice';
export default useTeamRoleStore;
