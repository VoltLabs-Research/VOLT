import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import type { TeamStore } from '@/types/stores/team/team';
import { createTeamSlice } from './team-slice';
import { createTeamRoleSlice, type TeamRoleSlice } from './role-slice';
import { setGetTeamId } from '@/api';

export const useTeamStore = create<TeamStore>()(combineSlices(createTeamSlice));
export const useTeamRoleStore = create<TeamRoleSlice>()(combineSlices(createTeamRoleSlice));

setGetTeamId(() => useTeamStore.getState().selectedTeam?._id || null);

export { default as useTeamJobsStore } from './jobs-slice';
export { type TeamRoleSlice, type TeamRoleState, type TeamRoleActions } from './role-slice';

