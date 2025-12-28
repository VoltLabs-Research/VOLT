export enum Resource {
    TEAM = 'team',
    TRAJECTORY = 'trajectory',
    TEAM_INVITATION = 'team-invitation',
    TEAM_MEMBER = 'team-member',
    TEAM_ROLE = 'team-role',
    SSH_CONNECTION = 'ssh-connection',
    PLUGIN = 'plugin',
    MESSAGE = 'message',
    CONTAINER = 'container',
    CHAT = 'chat',
    ANALYSIS = 'analysis'
}

export enum Action {
    READ = 'read',
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete'
}

export const getPermission = (resource: Resource, action: Action): string => {
    return `${resource}:${action}`;
};

export const getAllPermissionsForResource = (resource: Resource): string[] => {
    return Object.values(Action).map(action => getPermission(resource, action));
};