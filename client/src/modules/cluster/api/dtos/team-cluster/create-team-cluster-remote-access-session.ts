import type { TeamClusterRemoteAccessSession, TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';

/**
 * Requests a password-confirmed remote access session for a cluster resource.
 */
export interface CreateTeamClusterRemoteAccessSessionInputDTO {
    teamId: string;
    teamClusterId: string;
    password: string;
    target: TeamClusterRemoteAccessTarget;
};

/**
 * Returns the temporary session metadata used by a single remote action flow.
 */
export interface CreateTeamClusterRemoteAccessSessionOutputDTO {
    session: TeamClusterRemoteAccessSession;
};
