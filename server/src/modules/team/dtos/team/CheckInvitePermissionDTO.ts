import { TeamUserScopedInputDTO } from '@modules/team/dtos/common';

export type CheckInvitePermissionInputDTO = TeamUserScopedInputDTO;

export interface CheckInvitePermissionOutputDTO{
    canInvite: boolean;
};
