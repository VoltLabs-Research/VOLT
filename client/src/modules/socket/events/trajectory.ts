export const SOCKET_TRAJECTORY_EVENTS = {
    CREATED: 'trajectory.created',
    UPDATED: 'trajectory.updated',
    DELETED: 'trajectory.deleted'
} as const;

export const SOCKET_SCENE_ARTIFACT_EVENTS = {
    UPSERTED: 'scene-artifact.upserted'
} as const;
