export const USER_POPULATE = {
    path: 'createdBy',
    select: ['firstName', 'lastName', 'email', 'avatar']
} as const;

export const LAST_EDITED_BY_POPULATE = {
    path: 'lastEditedBy',
    select: ['firstName', 'lastName', 'email', 'avatar']
} as const;

export const CLUSTER_POPULATE = {
    path: 'teamCluster',
    select: ['name']
} as const;

export const TRAJECTORY_POPULATE = {
    path: 'trajectory',
    select: ['name']
} as const;

export const ROLE_POPULATE = {
    path: 'role',
    select: ['name']
} as const;
