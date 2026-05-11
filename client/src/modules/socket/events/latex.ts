export const SOCKET_LATEX_EVENTS = {
    OPEN: 'latex_open_document',
    CLOSE: 'latex_close_document',
    UPDATE_CONTENT: 'latex_update_content',
    CONTENT_UPDATED: 'latex_content_updated',
    FILE_JOIN: 'latex_file_join',
    FILE_LEAVE: 'latex_file_leave',
    FILE_UPDATE: 'latex_file_update',
    FILE_UPDATE_APPLIED: 'latex_file_update_applied',
    USERS_UPDATE: 'latex_users_update'
} as const;

export const SOCKET_LATEX_DOCUMENT_EVENTS = {
    CREATED: 'latex-document.created',
    DELETED: 'latex-document.deleted'
} as const;
