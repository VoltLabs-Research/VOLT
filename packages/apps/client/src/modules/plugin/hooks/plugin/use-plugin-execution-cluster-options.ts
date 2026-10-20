import { supportsPluginExecutionCluster } from '@/modules/plugin/utils/plugin-team-clusters';
import { useMemo } from 'react';
import type { PluginTeamClusterOption } from '@volt/contracts/modules/plugin/plugin';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';

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