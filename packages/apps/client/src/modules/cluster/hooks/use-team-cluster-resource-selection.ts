import { useClusterResourceLimitsQuery, useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { useEffect, useMemo } from 'react';
import type { TeamCluster } from '@volt/contracts/modules/cluster/domain';

interface UseTeamClusterResourceSelectionInput {
    teamId: string | null | undefined;
    selectedTeamClusterId: string | null;
    onSelectedTeamClusterIdChange: (teamClusterId: string | null) => void;
    includeResourceLimits?: boolean;
}

const useTeamClusterResourceSelection = ({
    teamId,
    selectedTeamClusterId,
    onSelectedTeamClusterIdChange,
    includeResourceLimits = true
}: UseTeamClusterResourceSelectionInput) => {
    const teamClustersQuery = useTeamClustersQuery(teamId ?? '');

    const teamClusters = useMemo<TeamCluster[]>(() => {
        return teamClustersQuery.data?.data ?? [];
    }, [teamClustersQuery.data?.data]);

    useEffect(() => {
        if (!teamId) {
            if (selectedTeamClusterId !== null) {
                onSelectedTeamClusterIdChange(null);
            }
            return;
        }

        if (selectedTeamClusterId && teamClusters.some((cluster) => cluster._id === selectedTeamClusterId)) {
            return;
        }

        onSelectedTeamClusterIdChange(teamClusters[0]?._id ?? null);
    }, [
        onSelectedTeamClusterIdChange,
        selectedTeamClusterId,
        teamClusters,
        teamId
    ]);

    const clusterResourceLimitsQuery = useClusterResourceLimitsQuery(
        {
            teamId: teamId ?? '',
            teamClusterId: selectedTeamClusterId ?? ''
        },
        {
            enabled: includeResourceLimits && Boolean(teamId) && Boolean(selectedTeamClusterId)
        }
    );

    return {
        teamClusters,
        isLoadingTeamClusters: teamClustersQuery.isLoading,
        clusterResourceLimits: includeResourceLimits ? (clusterResourceLimitsQuery.data ?? null) : null,
        isLoadingResourceLimits: includeResourceLimits ? clusterResourceLimitsQuery.isLoading : false
    };
};

export default useTeamClusterResourceSelection;
