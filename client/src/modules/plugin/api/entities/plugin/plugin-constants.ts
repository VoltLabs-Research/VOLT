export const PLUGIN_DEBUG_SOCKET_EVENTS = {
    SESSION_CREATED: 'debug:session:created',
    NODE_STARTED: 'debug:node:started',
    NODE_COMPLETED: 'debug:node:completed',
    NODE_SKIPPED: 'debug:node:skipped',
    NODE_ERROR: 'debug:node:error',
    NODE_LOG_CHUNK: 'debug:node:log-chunk',
    SESSION_COMPLETED: 'debug:session:completed',
    SESSION_ERROR: 'debug:session:error',
    START: 'debug:start',
    STEP: 'debug:step',
    CONTINUE: 'debug:continue',
    STOP: 'debug:stop'
} as const;
