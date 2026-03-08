import { useMemo } from 'react';
import { useTeamStore } from '@/modules/team/stores/use-team-store';
import { useTeamsQuery } from '@/modules/team/hooks/team/queries';

export const useSelectedTeam = () => {
    const selectedTeamId = useTeamStore((state) => state.selectedTeamId);
    const teamsQuery = useTeamsQuery(undefined);

    return useMemo(() => {
        if (!selectedTeamId) {
            return null;
        }

        return teamsQuery.data?.find((team) => team._id === selectedTeamId) ?? null;
    }, [selectedTeamId, teamsQuery.data]);
};

export const useSelectedTeamId = () => useTeamStore((state) => state.selectedTeamId);
