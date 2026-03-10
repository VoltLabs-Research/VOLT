import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type {
    TeamClusterRemoteAccessSessionDTO,
    TeamClusterRemoteAccessTargetDTO
} from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';

/**
 * Requests a password-confirmed remote access session for a cluster resource.
 */
export interface CreateTeamClusterRemoteAccessSessionInputDTO extends TeamUserScopedInputDTO {
    teamClusterId: string;
    password: string;
    target: TeamClusterRemoteAccessTargetDTO;
};

/**
 * Returns the temporary session metadata used by a single remote action flow.
 */
export interface CreateTeamClusterRemoteAccessSessionOutputDTO {
    session: TeamClusterRemoteAccessSessionDTO;
};
