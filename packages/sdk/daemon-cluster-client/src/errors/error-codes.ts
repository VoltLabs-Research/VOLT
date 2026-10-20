export enum DaemonClientErrorCode {
    EnrollmentFailed = 'ENROLLMENT_FAILED',

    SocketConnectionFailed = 'SOCKET_CONNECTION_FAILED',

    CommandTimeout = 'COMMAND_TIMEOUT',

    CommandRejected = 'COMMAND_REJECTED',

    SocketNotReady = 'SOCKET_NOT_READY',

    HandlerError = 'HANDLER_ERROR',

    EmitFailed = 'EMIT_FAILED',

    HeartbeatFailed = 'HEARTBEAT_FAILED'
};
