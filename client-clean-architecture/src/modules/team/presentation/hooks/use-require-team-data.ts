import { useTeamStore, type TeamSlice } from '@/modules/team/presentation/stores';
import { useTrajectories } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';

interface UseRequireTeamDataOptions {
    enabled?: boolean;
    teamId?: string;
}

const useRequireTeamData = (options: UseRequireTeamDataOptions = {}) => {
    const { enabled = true, teamId } = options;
    const selectedTeam = useTeamStore((state: TeamSlice) => state.selectedTeam);

    const currentTeamId = teamId || selectedTeam?._id;

    const { trajectories, isLoading } = useTrajectories({ 
        teamId: currentTeamId,
        limit: 20 
    }, { enabled: enabled && !!currentTeamId });

    return {
        isLoading,
        trajectories
    };
};

export default useRequireTeamData;
