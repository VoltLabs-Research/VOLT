import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type {
    TeamClusterRemoteAccessTargetDTO,
    TeamClusterRemoteExplorerNodeDTO
} from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';

/**
 * Requests the rendered payload for a selected remote explorer node.
 */
export interface GetTeamClusterRemoteExplorerNodeInputDTO extends TeamUserScopedInputDTO {
    teamClusterId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
};

/**
 * Returns the content payload associated with a selected remote explorer node.
 */
export interface GetTeamClusterRemoteExplorerNodeOutputDTO {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    node: TeamClusterRemoteExplorerNodeDTO;
};
