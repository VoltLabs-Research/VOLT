export const SOCKET_TEAM_EVENTS = {
    SUBSCRIBE: 'subscribe_to_team',
    LEAVE: 'leave_team',
    HEARTBEAT: 'team:heartbeat',
    PRESENCE_SNAPSHOT: 'user:list',
    USER_ONLINE: 'user:online',
    USER_OFFLINE: 'user:offline',
    JOBS_INITIAL: 'team.jobs.initial',
    JOB_UPDATED: 'team.job.updated'
} as const;

export const SOCKET_TEAM_AI_INTEGRATION_EVENTS = {
    CREATED: 'team-ai-integration.created',
    UPDATED: 'team-ai-integration.updated',
    DELETED: 'team-ai-integration.deleted'
} as const;
