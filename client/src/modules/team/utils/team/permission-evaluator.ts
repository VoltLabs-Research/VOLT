export type PermissionMode = 'any' | 'all';

const hasPermission = (permissions: string[], permission: string): boolean => {
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
