import type { TeamClusterRole } from '@/modules/cluster/api/types/team-cluster';
import type { PluginTeamClusterOption } from '@/modules/plugin/api/types/plugin/team-cluster';

const EXECUTION_CLUSTER_ROLES = new Set<TeamClusterRole>(['cluster', 'compute-node']);

export const supportsPluginExecutionRole = (role?: TeamClusterRole): boolean => {
    return Boolean(role && EXECUTION_CLUSTER_ROLES.has(role));
};

export const supportsPluginExecutionCluster = (teamCluster: PluginTeamClusterOption): boolean => {
    return supportsPluginExecutionRole(teamCluster.roleConfig?.effectiveRole);
};

export const resolvePluginExecutionClusterId = (
    requestedClusterId: string | null | undefined,
    teamClusters: PluginTeamClusterOption[]
): string => {
    if (requestedClusterId) {
        const selectedCluster = teamClusters.find((teamCluster) => teamCluster._id === requestedClusterId);
        if (selectedCluster) {
            return selectedCluster._id;
        }
    }

    return teamClusters[0]?._id ?? '';
};
