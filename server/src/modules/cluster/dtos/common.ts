import type { TeamUserScopedEntityIdInputDTO } from '@modules/cluster/dtos/_teamScoped';
import type { TeamClusterRemoteAccessTargetDTO } from '@modules/cluster/contracts/TeamClusterRemoteAccess';

export type TeamUserScopedClusterInputDTO = TeamUserScopedEntityIdInputDTO<'teamClusterId'>;

export type PasswordConfirmedTeamClusterInputDTO = TeamUserScopedClusterInputDTO & {
    password: string;
};

export type TeamClusterRemoteExplorerInputDTO = TeamUserScopedClusterInputDTO & {
    sessionId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    path: string;
};
