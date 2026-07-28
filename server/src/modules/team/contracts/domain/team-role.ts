export interface TeamRoleIdentity{
    name: string;
    isSystem: boolean;
}

export interface TeamRoleMutableInput{
    name?: string;
    permissions?: string[];
}

export interface TeamRoleUpdatePayload{
    name?: string;
    permissions?: string[];
}

export interface TeamRoleCreateInput{
    teamId: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
}

export interface TeamRoleCreatePayload{
    team: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
}

export const canRenameTeamRoleTo = (role: TeamRoleIdentity, name?: string): boolean => {
    if(!name) return true;
    if(!role.isSystem) return true;

    return name === role.name;
};

export const buildTeamRoleUpdatePayload = (role: Pick<TeamRoleIdentity, 'isSystem'>, input: TeamRoleMutableInput): TeamRoleUpdatePayload => {
    const payload: TeamRoleUpdatePayload = {};
    if(input.permissions !== undefined) payload.permissions = input.permissions;
    if(!role.isSystem && input.name !== undefined) payload.name = input.name;

    return payload;
};

export const buildTeamRoleCreatePayload = (input: TeamRoleCreateInput): TeamRoleCreatePayload => ({
    team: input.teamId,
    name: input.name,
    permissions: [...new Set(input.permissions)],
    isSystem: input.isSystem
});
