import type { OperationSuccessDTO } from '@modules/team/application/dtos/common';

export interface CompleteTeamClusterDeletionInputDTO {
    teamClusterId: string;
    daemonPassword: string;
};

export type CompleteTeamClusterDeletionOutputDTO = OperationSuccessDTO;
