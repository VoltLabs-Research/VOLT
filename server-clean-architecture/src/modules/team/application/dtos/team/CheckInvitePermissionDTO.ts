export interface CheckInvitePermissionInputDTO{
    teamId: string;
    userId: string;
};

export interface CheckInvitePermissionOutputDTO{
    canInvite: boolean;
};
