import { RBACResource, Action } from '@/constants/permissions';
import { Resource } from '@/constants/resources';

const allActionsFor = (resource: RBACResource): string[] =>
    Object.values(Action).map(action => `${resource}:${action}`);

const readOnlyFor = (resource: RBACResource): string => `${resource}:${Action.READ}`;

const crudFor = (resource: RBACResource): string[] => [
    `${resource}:${Action.READ}`,
    `${resource}:${Action.CREATE}`,
    `${resource}:${Action.UPDATE}`,
    `${resource}:${Action.DELETE}`
];

export const SystemRoleNames = {
    OWNER: 'Owner',
    ADMIN: 'Admin',
    MEMBER: 'Member',
    VIEWER: 'Viewer'
} as const;

export const SystemRoles = {
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
            ...allActionsFor(Resource.CONTAINER),
            ...allActionsFor(Resource.SSH_CONNECTION),
            ...allActionsFor(Resource.TEAM_INVITATION),
            ...allActionsFor(Resource.TEAM_MEMBER),
            ...allActionsFor(Resource.TEAM_ROLE)
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
            ...crudFor(Resource.CONTAINER),
            ...crudFor(Resource.SSH_CONNECTION)
        ],
        isSystem: true
    },
    [SystemRoleNames.VIEWER]: {
        name: SystemRoleNames.VIEWER,
        permissions: [
            readOnlyFor(Resource.TRAJECTORY),
            readOnlyFor(Resource.ANALYSIS),
            readOnlyFor(Resource.PLUGIN),
            readOnlyFor(Resource.CONTAINER),
        ],
        isSystem: true
    }
} as const;

export const DEFAULT_MEMBER_ROLE = SystemRoleNames.MEMBER;
