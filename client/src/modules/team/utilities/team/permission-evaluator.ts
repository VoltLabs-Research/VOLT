export type PermissionMode = 'any' | 'all';

interface TeamPermissionScopeInput {
    selectedTeamId: string | null;
    permissionsTeamId: string | null;
    permissions: string[];
};

interface TeamPermissionAccessInput extends TeamPermissionScopeInput {
    requiredPermissions?: string[];
    mode?: PermissionMode;
};

export const hasPermission = (permissions: string[], permission: string): boolean => {
    return permissions.includes('*') || permissions.includes(permission);
};

export const canAccessByPermissions = (
    permissions: string[],
    requiredPermissions: string[] = [],
    mode: PermissionMode = 'any'
): boolean => {
    if (requiredPermissions.length === 0) return true;
    if (mode === 'all') {
        return requiredPermissions.every((permission) => hasPermission(permissions, permission));
    }
    return requiredPermissions.some((permission) => hasPermission(permissions, permission));
};

export const getScopedPermissions = ({
    selectedTeamId,
    permissionsTeamId,
    permissions
}: TeamPermissionScopeInput): string[] => {
    if (!selectedTeamId) return [];
    if (permissionsTeamId !== selectedTeamId) return [];
    return permissions;
};

export const isPermissionScopeReady = ({
    selectedTeamId,
    permissionsTeamId
}: Pick<TeamPermissionScopeInput, 'selectedTeamId' | 'permissionsTeamId'>): boolean => {
    if (!selectedTeamId) return false;
    return permissionsTeamId === selectedTeamId;
};

export const canAccessTeamPermissions = ({
    selectedTeamId,
    permissionsTeamId,
    permissions,
    requiredPermissions = [],
    mode = 'any'
}: TeamPermissionAccessInput): boolean => {
    const scopedPermissions = getScopedPermissions({
        selectedTeamId,
        permissionsTeamId,
        permissions
    });

    return canAccessByPermissions(scopedPermissions, requiredPermissions, mode);
};
