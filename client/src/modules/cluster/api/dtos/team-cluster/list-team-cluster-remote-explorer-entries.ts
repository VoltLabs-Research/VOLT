import type { TeamClusterRemoteAccessTarget, TeamClusterRemoteExplorerEntry } from '@/modules/cluster/api/entities/team-cluster-remote-access';

/**
 * Requests the navigable entries for the current remote explorer path.
 */
export interface ListTeamClusterRemoteExplorerEntriesInputDTO {
    teamId: string;
    teamClusterId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
};

/**
 * Returns the navigable entries for the current remote explorer path.
 */
export interface ListTeamClusterRemoteExplorerEntriesOutputDTO {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
    entries: TeamClusterRemoteExplorerEntry[];
};
