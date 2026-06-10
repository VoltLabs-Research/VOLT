/**
 * Typed error codes emitted by `ClusterDaemonClient`.
 *
 * Consumers can switch on `DaemonClientError.code` to handle specific
 * failure modes without parsing message strings.
 */
export enum DaemonClientErrorCode {
    /** Enrollment HTTP request failed or returned an unexpected response. */
    EnrollmentFailed = 'ENROLLMENT_FAILED',

    /** Control socket could not establish an initial connection. */
    SocketConnectionFailed = 'SOCKET_CONNECTION_FAILED',

    /** Socket registration (`team-cluster-daemon:register`) was not acknowledged. */
    SocketRegistrationFailed = 'SOCKET_REGISTRATION_FAILED',

    /** A `sendCommand` call did not receive a response within the configured timeout. */
    CommandTimeout = 'COMMAND_TIMEOUT',

    /** The server replied to a command with `ok: false`. */
    CommandRejected = 'COMMAND_REJECTED',

    /** A command was attempted while the socket was not connected or registered. */
    SocketNotReady = 'SOCKET_NOT_READY',

    /** A registered handler threw an unhandled exception. */
    HandlerError = 'HANDLER_ERROR',

    /** An outbound emit was attempted while the socket was not connected. */
    EmitFailed = 'EMIT_FAILED',

    /** A periodic heartbeat send failed for a reason other than a timeout. */
    HeartbeatFailed = 'HEARTBEAT_FAILED'
};
