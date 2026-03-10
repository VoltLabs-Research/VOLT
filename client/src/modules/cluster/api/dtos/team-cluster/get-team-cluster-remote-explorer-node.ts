import type { TeamClusterRemoteAccessTarget, TeamClusterRemoteExplorerNode } from '@/modules/cluster/api/entities/team-cluster-remote-access';

/**
 * Requests the rendered payload for a selected remote explorer node.
 */
export interface GetTeamClusterRemoteExplorerNodeInputDTO {
    teamId: string;
    teamClusterId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
};

/**
 * Returns the content payload associated with a selected remote explorer node.
 */
export interface GetTeamClusterRemoteExplorerNodeOutputDTO {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    node: TeamClusterRemoteExplorerNode;
};
