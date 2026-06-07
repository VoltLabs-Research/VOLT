import { supportsPluginExecutionCluster } from '@/modules/plugin/utilities/plugin-team-clusters';
import { useMemo } from 'react';
import type { PluginTeamClusterOption } from '@/modules/plugin/api/entities/plugin/team-cluster';
import type { SelectOption } from '@voltstack/bravais';

interface PluginExecutionClusterOptions {
    executionTeamClusters: PluginTeamClusterOption[];
    teamClusterOptions: SelectOption[];
    hasTeamClusterOptions: boolean;
}

const toTeamClusterOption = (teamCluster: PluginTeamClusterOption): SelectOption => ({
    value: teamCluster._id,
    title: teamCluster.name
});

export const usePluginExecutionClusterOptions = (
    teamClusters: PluginTeamClusterOption[] | undefined
): PluginExecutionClusterOptions => {
    return useMemo(() => {
        const executionTeamClusters = (teamClusters ?? []).filter(supportsPluginExecutionCluster);
        const teamClusterOptions = executionTeamClusters.map(toTeamClusterOption);

        return {
            executionTeamClusters,
            teamClusterOptions,
            hasTeamClusterOptions: teamClusterOptions.length > 0
        };
    }, [teamClusters]);
};
