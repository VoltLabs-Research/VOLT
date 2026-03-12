export const USER_POPULATE = {
    path: 'createdBy',
    select: ['firstName', 'lastName', 'email', 'avatar']
};

export const LAST_EDITED_BY_POPULATE = {
    path: 'lastEditedBy',
    select: ['firstName', 'lastName', 'email', 'avatar']
};

export const CLUSTER_POPULATE = {
    path: 'teamCluster',
    select: ['name']
};

export const TRAJECTORY_POPULATE = {
    path: 'trajectory',
    select: ['name']
};

export const ROLE_POPULATE = {
    path: 'role',
    select: ['name']
};
