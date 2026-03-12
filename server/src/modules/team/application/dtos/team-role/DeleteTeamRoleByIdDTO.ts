import { OperationSuccessDTO, TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type DeleteTeamRoleByIdInputDTO = TeamScopedEntityIdInputDTO<'roleId'> & { userId?: string };

export type DeleteTeamRoleByIdOutputDTO = OperationSuccessDTO;
