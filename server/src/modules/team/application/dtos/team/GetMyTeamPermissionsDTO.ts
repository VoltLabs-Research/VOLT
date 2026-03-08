import { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';

export type GetMyTeamPermissionsInputDTO = TeamUserScopedInputDTO;

export interface GetMyTeamPermissionsOutputDTO {
    permissions: string[];
}
