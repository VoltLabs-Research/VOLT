import { OperationSuccessDTO, TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type DeleteTeamRoleByIdInputDTO = TeamScopedEntityIdInputDTO<'roleId'>;

export type DeleteTeamRoleByIdOutputDTO = OperationSuccessDTO;
