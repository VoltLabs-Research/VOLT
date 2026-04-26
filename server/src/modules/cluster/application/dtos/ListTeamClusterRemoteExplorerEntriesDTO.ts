import type {
    TeamClusterRemoteAccessTargetDTO,
    TeamClusterRemoteExplorerEntryDTO
} from '@modules/cluster/application/dtos/TeamClusterRemoteAccessDTO';
import type { TeamClusterRemoteExplorerInputDTO } from './common';

/**
 * Requests the navigable entries for the current remote explorer path.
 */
export type ListTeamClusterRemoteExplorerEntriesInputDTO = TeamClusterRemoteExplorerInputDTO;

/**
 * Returns the navigable entries for the current remote explorer path.
 */
export interface ListTeamClusterRemoteExplorerEntriesOutputDTO {
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
    entries: TeamClusterRemoteExplorerEntryDTO[];
};
