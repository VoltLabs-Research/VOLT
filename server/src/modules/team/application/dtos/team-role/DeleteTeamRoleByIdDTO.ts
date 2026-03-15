import { OperationSuccessDTO, TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export interface DeleteTeamRoleByIdInputDTO extends TeamScopedEntityIdInputDTO<'roleId'> {
    userId: string;
};

export type DeleteTeamRoleByIdOutputDTO = OperationSuccessDTO;
