export interface GetMyTeamPermissionsInputDTO {
    teamId: string;
    userId: string;
}

export interface GetMyTeamPermissionsOutputDTO {
    permissions: string[];
}
