import { OperationSuccessDTO, TeamScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export interface DeleteTeamRoleByIdInputDTO extends TeamScopedEntityIdInputDTO<'roleId'> {
    userId: string;
};

export type DeleteTeamRoleByIdOutputDTO = OperationSuccessDTO;
