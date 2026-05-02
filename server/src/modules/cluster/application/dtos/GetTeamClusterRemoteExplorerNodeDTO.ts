import type {
    TeamClusterRemoteAccessTargetDTO,
    TeamClusterRemoteExplorerNodeDTO
} from '@modules/cluster/application/dtos/TeamClusterRemoteAccessDTO';
import type { TeamClusterRemoteExplorerInputDTO } from './common';

/**
 * Requests the rendered payload for a selected remote explorer node.
 */
export type GetTeamClusterRemoteExplorerNodeInputDTO = TeamClusterRemoteExplorerInputDTO;

/**
 * Returns the content payload associated with a selected remote explorer node.
 */
export interface GetTeamClusterRemoteExplorerNodeOutputDTO {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    node: TeamClusterRemoteExplorerNodeDTO;
}
