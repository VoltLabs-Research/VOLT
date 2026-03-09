import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';

export interface DeleteTeamClusterByIdInputDTO extends TeamUserScopedInputDTO {
    teamClusterId: string;
    password: string;
};

export interface DeleteTeamClusterByIdOutputDTO {
    success: boolean;
    deleted: boolean;
    manualUninstallRequired: boolean;
    message: string;
    manualUninstallCommand?: string;
    teamCluster?: TeamClusterDTO;
};
