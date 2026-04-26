export const SOCKET_TRAJECTORY_EVENTS = {
    CREATED: 'trajectory.created',
    UPDATED: 'trajectory.updated',
    DELETED: 'trajectory.deleted'
} as const;

export const SOCKET_TRAJECTORY_PRESENCE_EVENTS = {
    JOIN: 'trajectory.presence.join',
    LEAVE: 'trajectory.presence.leave',
    UPDATE: 'trajectory.presence.update'
} as const;

export const SOCKET_SCENE_ARTIFACT_EVENTS = {
    UPSERTED: 'scene-artifact.upserted'
} as const;
