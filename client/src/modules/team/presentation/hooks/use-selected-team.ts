import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';

export const useSelectedTeam = () => useTeamStore((state) => state.selectedTeam);
