import { Resource } from './resources';

export type RBACResource = Resource;

export enum Action {
    READ = 'read',
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete'
}