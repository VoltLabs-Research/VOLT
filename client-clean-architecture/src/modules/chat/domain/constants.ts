export const CHAT_SOCKET_EVENTS = {
    // Client to Server
    JOIN_CHAT: 'join_chat',
    LEAVE_CHAT: 'leave_chat',
    SEND_MESSAGE: 'send_message',
    SEND_FILE_MESSAGE: 'send_file_message',
    EDIT_MESSAGE: 'edit_message',
    DELETE_MESSAGE: 'delete_message',
    TOGGLE_REACTION: 'toggle_reaction',
    MARK_READ: 'mark_read',
    TYPING_START: 'typing_start',
    TYPING_STOP: 'typing_stop',
    GET_USERS_PRESENCE: 'get_users_presence',
    GROUP_CREATED: 'group_created',
    USERS_ADDED_TO_GROUP: 'users_added_to_group',
    USERS_REMOVED_FROM_GROUP: 'users_removed_from_group',
    GROUP_INFO_UPDATED: 'group_info_updated',
    USER_LEFT_GROUP: 'user_left_group',

    // Server to Client
    JOINED_CHAT: 'joined_chat',
    LEFT_CHAT: 'left_chat',
    NEW_MESSAGE: 'new_message',
    MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted',
    REACTION_UPDATED: 'reaction_updated',
    MESSAGES_READ: 'messages_read',
    USER_TYPING: 'user_typing',
    USERS_PRESENCE_INFO: 'users_presence_info',
    ERROR: 'error'
} as const;

export const COMMON_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];
