import { Resource } from './resources';

export type RBACResource = 
    | Resource.TEAM 
    | Resource.TRAJECTORY
    | Resource.TEAM_INVITATION
    | Resource.TEAM_MEMBER 
    | Resource.TEAM_ROLE
    | Resource.TEAM_SECRET_KEY
    | Resource.SSH_CONNECTION
    | Resource.PLUGIN
    | Resource.CONTAINER
    | Resource.ANALYSIS
    | Resource.SIMULATION_CELL
    | Resource.AI_CONVERSATION;
    
export enum Action {
    READ = 'read',
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete'
}