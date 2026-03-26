import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { useClusterResourceLimitsQuery } from '@/modules/container/hooks/queries';
import { useEffect, useMemo } from 'react';
import type { TeamClusterOption } from '@/modules/container/api/entities/team-cluster-option';

interface UseTeamClusterResourceSelectionInput {
    teamId: string | null | undefined;
    selectedTeamClusterId: string | null;
    onSelectedTeamClusterIdChange: (teamClusterId: string | null) => void;
    autoSelectFirstCluster?: boolean;
};

const toTeamClusterOptions = (teamClusters: Array<{ _id: string; name: string; status: string }>): TeamClusterOption[] => {
    return teamClusters.map((teamCluster) => ({
        _id: teamCluster._id,
        name: teamCluster.name,
        status: teamCluster.status
    }));
};

const useTeamClusterResourceSelection = ({
    teamId,
    selectedTeamClusterId,
    onSelectedTeamClusterIdChange,
    autoSelectFirstCluster = true
}: UseTeamClusterResourceSelectionInput) => {
    const teamClustersQuery = useTeamClustersQuery(teamId ?? '', {
        enabled: Boolean(teamId)
    });

    const teamClusters = useMemo(() => {
        return toTeamClusterOptions(teamClustersQuery.data?.data ?? []);
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

        if (!autoSelectFirstCluster) {
            if (selectedTeamClusterId !== null) {
                onSelectedTeamClusterIdChange(null);
            }
            return;
        }

        onSelectedTeamClusterIdChange(teamClusters[0]?._id ?? null);
    }, [
        autoSelectFirstCluster,
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
            enabled: Boolean(teamId) && Boolean(selectedTeamClusterId)
        }
    );

    return {
        teamClusters,
        isLoadingTeamClusters: teamClustersQuery.isLoading,
        clusterResourceLimits: clusterResourceLimitsQuery.data ?? null,
        isLoadingResourceLimits: clusterResourceLimitsQuery.isLoading
    };
};

export default useTeamClusterResourceSelection;
