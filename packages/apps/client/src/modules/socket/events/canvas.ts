export const SOCKET_CANVAS_LOBBY_EVENTS = {
    JOIN: 'canvas.lobby.join',
    LEAVE: 'canvas.lobby.leave',
    UPDATE: 'canvas.lobby.update'
} as const;

export const SOCKET_CANVAS_WORKSPACE_EVENTS = {
    VISIT: 'canvas.workspace.visit',
    LEAVE: 'canvas.workspace.leave',
    VIEWERS: 'canvas.workspace.viewers',
    SYNC_STATE: 'canvas.workspace.sync_state',
    APPLY_PATCH: 'canvas.workspace.apply_patch',
    PUBLISH_SNAPSHOT: 'canvas.workspace.publish_snapshot',
    PATCH: 'canvas.workspace.patch',
    CLOSED: 'canvas.workspace.closed',
    CURSOR: 'canvas.workspace.cursor',
    MODEL_DRAG: 'canvas.workspace.model_drag'
} as const;
