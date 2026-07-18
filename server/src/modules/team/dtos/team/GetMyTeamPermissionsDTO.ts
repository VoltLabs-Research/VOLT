import { TeamUserScopedInputDTO } from '@modules/team/dtos/common';

export type GetMyTeamPermissionsInputDTO = TeamUserScopedInputDTO;

export interface GetMyTeamPermissionsOutputDTO {
    permissions: string[];
};
