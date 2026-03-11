import { Action } from './permissions';
import { Resource } from './resources';
import type { RBACResource } from './permissions';

const createReadonlyMap = <T extends Record<string, string>>(value: T): Readonly<T> => Object.freeze(value);

const allActionsFor = (resource: RBACResource): string[] =>
    Object.values(Action).map(action => `${resource}:${action}`);

const readOnlyFor = (resource: RBACResource): string => `${resource}:${Action.READ}`;

const crudFor = (resource: RBACResource): string[] => [
    `${resource}:${Action.READ}`,
    `${resource}:${Action.CREATE}`,
    `${resource}:${Action.UPDATE}`,
    `${resource}:${Action.DELETE}`
];

export const SystemRoleNames = createReadonlyMap({
    OWNER: 'Owner',
    ADMIN: 'Admin',
    MEMBER: 'Member',
    VIEWER: 'Viewer'
});

export const SystemRoles = Object.freeze({
    [SystemRoleNames.OWNER]: {
        name: SystemRoleNames.OWNER,
        permissions: ['*'],
        isSystem: true
    },
    [SystemRoleNames.ADMIN]: {
        name: SystemRoleNames.ADMIN,
        permissions: [
            ...allActionsFor(Resource.TRAJECTORY),
            ...allActionsFor(Resource.ANALYSIS),
            ...allActionsFor(Resource.PLUGIN),
            ...allActionsFor(Resource.SCRIPTING),
            ...allActionsFor(Resource.CONTAINER),
            ...allActionsFor(Resource.DAILY_ACTIVITY),
            ...allActionsFor(Resource.SSH_CONNECTION),
            ...allActionsFor(Resource.TEAM_INVITATION),
            ...allActionsFor(Resource.TEAM_MEMBER),
            ...allActionsFor(Resource.TEAM_ROLE),
            ...allActionsFor(Resource.SIMULATION_CELL),
            ...allActionsFor(Resource.AI_CONVERSATION),
            ...allActionsFor(Resource.WHITEBOARD)
        ],
        isSystem: true
    },
    [SystemRoleNames.MEMBER]: {
        name: SystemRoleNames.MEMBER,
        permissions: [
            ...crudFor(Resource.TRAJECTORY),
            ...crudFor(Resource.ANALYSIS),
            readOnlyFor(Resource.PLUGIN),
            `${Resource.PLUGIN}:${Action.CREATE}`,
            ...crudFor(Resource.SCRIPTING),
            ...crudFor(Resource.CONTAINER),
            readOnlyFor(Resource.DAILY_ACTIVITY),
            ...crudFor(Resource.SSH_CONNECTION),
            readOnlyFor(Resource.SIMULATION_CELL),
            readOnlyFor(Resource.AI_CONVERSATION),
            `${Resource.AI_CONVERSATION}:${Action.CREATE}`,
            `${Resource.AI_CONVERSATION}:${Action.UPDATE}`,
            `${Resource.AI_CONVERSATION}:${Action.DELETE}`,
            ...crudFor(Resource.WHITEBOARD)
        ],
        isSystem: true
    },
    [SystemRoleNames.VIEWER]: {
        name: SystemRoleNames.VIEWER,
        permissions: [
            readOnlyFor(Resource.TRAJECTORY),
            readOnlyFor(Resource.ANALYSIS),
            readOnlyFor(Resource.PLUGIN),
            readOnlyFor(Resource.SCRIPTING),
            readOnlyFor(Resource.CONTAINER),
            readOnlyFor(Resource.DAILY_ACTIVITY),
            readOnlyFor(Resource.SIMULATION_CELL),
            readOnlyFor(Resource.WHITEBOARD)
        ],
        isSystem: true
    }
});
