import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import type { PasswordConfirmedTeamClusterInputDTO } from './common';

export type DeleteTeamClusterByIdInputDTO = PasswordConfirmedTeamClusterInputDTO;

export interface DeleteTeamClusterByIdOutputDTO {
    success: boolean;
    deleted: boolean;
    manualUninstallRequired: boolean;
    message: string;
    manualUninstallCommand?: string;
    teamCluster?: TeamClusterDTO;
};
