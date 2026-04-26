import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterRemoteAccessTargetDTO } from './TeamClusterRemoteAccessDTO';

export type TeamUserScopedClusterInputDTO = TeamUserScopedEntityIdInputDTO<'teamClusterId'>;

export type PasswordConfirmedTeamClusterInputDTO = TeamUserScopedClusterInputDTO & {
    password: string;
};

export type TeamClusterRemoteExplorerInputDTO = TeamUserScopedClusterInputDTO & {
    sessionId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
};
