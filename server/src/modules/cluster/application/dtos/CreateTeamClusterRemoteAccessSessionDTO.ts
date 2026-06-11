import type {
    TeamClusterRemoteAccessSessionDTO,
    TeamClusterRemoteAccessTargetDTO
} from '@modules/cluster/domain/contracts/TeamClusterRemoteAccess';
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
}
