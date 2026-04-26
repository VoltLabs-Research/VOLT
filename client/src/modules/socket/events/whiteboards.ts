export const SOCKET_WHITEBOARD_EVENTS = {
    SUBSCRIBE: 'subscribe_to_whiteboard',
    UNSUBSCRIBE: 'unsubscribe_from_whiteboard',
    PATCH: 'whiteboard_patch',
    SYNC_STATE: 'whiteboard_sync_state',
    APPLY_DELTA: 'whiteboard_apply_delta',
    USERS_UPDATE: 'whiteboard_users_update',
    CREATED: 'whiteboard.created',
    DELETED: 'whiteboard.deleted'
} as const;
