export const SOCKET_WHITEBOARD_EVENTS = {
    SUBSCRIBE: 'subscribe_to_whiteboard',
    UNSUBSCRIBE: 'unsubscribe_from_whiteboard',
    PATCH: 'whiteboard_patch',
    APPLY_DELTA: 'whiteboard_apply_delta',
    USERS_UPDATE: 'whiteboard_users_update',
    DELETED: 'whiteboard.deleted'
} as const;
