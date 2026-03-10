import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type {
    TeamClusterRemoteAccessTargetDTO,
    TeamClusterRemoteExplorerEntryDTO
} from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';

/**
 * Requests the navigable entries for the current remote explorer path.
 */
export interface ListTeamClusterRemoteExplorerEntriesInputDTO extends TeamUserScopedInputDTO {
    teamClusterId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
};

/**
 * Returns the navigable entries for the current remote explorer path.
 */
export interface ListTeamClusterRemoteExplorerEntriesOutputDTO {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
    entries: TeamClusterRemoteExplorerEntryDTO[];
};
