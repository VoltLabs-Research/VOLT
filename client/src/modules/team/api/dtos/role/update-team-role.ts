export interface UpdateTeamRoleInputDTO {
    teamId: string;
    roleId: string;
    name?: string;
    permissions?: string[];
}
