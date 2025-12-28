import { Resource } from '@/constants/resources';

export type RBACResource = 
    | Resource.TEAM 
    | Resource.TRAJECTORY
    | Resource.TEAM_INVITATION
    | Resource.TEAM_MEMBER 
    | Resource.TEAM_ROLE
    | Resource.SSH_CONNECTION
    | Resource.PLUGIN
    | Resource.CONTAINER
    | Resource.ANALYSIS;
    
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