import type {
    TeamClusterRemoteAccessSessionDTO,
    TeamClusterRemoteAccessTargetDTO
} from '@modules/team-cluster/application/dtos/TeamClusterRemoteAccessDTO';
import type { PasswordConfirmedTeamClusterInputDTO } from './common';

/**
 * Requests a password-confirmed remote access session for a cluster resource.
 */
export type CreateTeamClusterRemoteAccessSessionInputDTO = PasswordConfirmedTeamClusterInputDTO & {
    target: TeamClusterRemoteAccessTargetDTO;
};

/**
 * Returns the temporary session metadata used by a single remote action flow.
 */
export interface CreateTeamClusterRemoteAccessSessionOutputDTO {
    session: TeamClusterRemoteAccessSessionDTO;
};
