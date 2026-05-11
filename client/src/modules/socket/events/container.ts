export const SOCKET_CONTAINER_EVENTS = {
    DEPLOY_PROGRESS: 'container.deploy.progress',
    CREATED: 'container.created',
    UPDATED: 'container.updated',
    DELETED: 'container.deleted'
} as const;

export const SOCKET_CONTAINER_TERMINAL_EVENTS = {
    ATTACH: 'container:terminal:attach',
    DETACH: 'container:terminal:detach',
    DATA: 'container:terminal:data',
    INPUT: 'container:terminal:input',
    RESIZE: 'container:terminal:resize',
    SIZE: 'container:terminal:size',
    ERROR: 'container:error'
} as const;
