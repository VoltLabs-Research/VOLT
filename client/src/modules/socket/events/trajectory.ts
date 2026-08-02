import type { PresenceUser } from '@volt/contracts/modules/socket/domain';

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

// The VOLT server broadcasts presence for a single trajectory room, so the update carries the
// room roster only -- the trajectory is implied by the room the client joined.
export type TrajectoryPresenceUpdateSocketPayload = PresenceUser[];
