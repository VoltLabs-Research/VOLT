export const RESOURCES = [
    { key: 'team', label: 'Team' },
    { key: 'trajectory', label: 'Trajectories' },
    { key: 'team-invitation', label: 'Invitations' },
    { key: 'team-member', label: 'Members' },
    { key: 'team-role', label: 'Roles' },
    { key: 'ssh-connection', label: 'SSH Connections' },
    { key: 'plugin', label: 'Plugins' },
    { key: 'message', label: 'Messages' },
    { key: 'container', label: 'Containers' },
    { key: 'analysis', label: 'Analysis' }
] as const;

export const ACTIONS = [
    { key: 'read', label: 'Read' },
    { key: 'create', label: 'Create' },
    { key: 'update', label: 'Update' },
    { key: 'delete', label: 'Delete' }
] as const;

export type ResourceKey = typeof RESOURCES[number]['key'];
export type ActionKey = typeof ACTIONS[number]['key'];

/**
 * Generate a permission string from resource and action.
 */
export const getPermission = (resource: ResourceKey, action: ActionKey): string => {
    return `${resource}:${action}`;
};

/**
 * Parse a permission string into resource and action.
 */
export const parsePermission = (permission: string): { resource: string; action: string } | null => {
    const parts = permission.split(':');
    if (parts.length !== 2) return null;
    return { resource: parts[0], action: parts[1] };
};

/**
 * Check if a permissions array includes a specific permission.
 * Also handles wildcard '*' permission.
 */
export const hasPermission = (permissions: string[], resource: ResourceKey, action: ActionKey): boolean => {
    if (permissions.includes('*')) return true;
    return permissions.includes(getPermission(resource, action));
};
