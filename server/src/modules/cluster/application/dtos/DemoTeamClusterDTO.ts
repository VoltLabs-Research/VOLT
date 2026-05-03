import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';

export type ProvisionDemoTeamClusterInputDTO = TeamUserScopedInputDTO;

export interface ProvisionDemoTeamClusterOutputDTO {
    teamCluster: TeamClusterDTO;
}

export type GetDemoTeamClusterStatusInputDTO = TeamUserScopedInputDTO;

export interface GetDemoTeamClusterStatusOutputDTO {
    teamCluster: TeamClusterDTO | null;
    remainingMs: number | null;
    hasActiveDemo: boolean;
}

export type DeleteDemoTeamClusterInputDTO = TeamUserScopedInputDTO;

export interface DeleteDemoTeamClusterOutputDTO {
    teardownScheduled: boolean;
}
