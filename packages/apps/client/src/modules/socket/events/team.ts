export const SOCKET_TEAM_EVENTS = {
    SUBSCRIBE: 'subscribe_to_team',
    LEAVE: 'leave_team',
    HEARTBEAT: 'team:heartbeat',
    PRESENCE_SNAPSHOT: 'user:list',
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',
    JOBS_INITIAL: 'team.jobs.initial',
    JOB_UPDATED: 'team.job.updated',
    CREATED: 'team.created',
    DELETED: 'team.deleted'
} as const;

export const SOCKET_TEAM_AI_INTEGRATION_EVENTS = {
    CREATED: 'team-ai-integration.created',
    UPDATED: 'team-ai-integration.updated',
    DELETED: 'team-ai-integration.deleted'
} as const;

export const SOCKET_TEAM_MEMBER_EVENTS = {
    CREATED: 'team-member.created',
    DELETED: 'team-member.deleted',
    LEFT: 'team-member.left'
} as const;

export const SOCKET_TEAM_ROLE_EVENTS = {
    CREATED: 'team-role.created',
    DELETED: 'team-role.deleted',
    UPDATED: 'team-role.updated'
} as const;

export const SOCKET_SECRET_KEY_EVENTS = {
    CREATED: 'secret-key.created',
    DELETED: 'secret-key.deleted'
} as const;
