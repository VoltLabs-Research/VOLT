import { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';

export type CheckInvitePermissionInputDTO = TeamUserScopedInputDTO;

export interface CheckInvitePermissionOutputDTO{
    canInvite: boolean;
};
