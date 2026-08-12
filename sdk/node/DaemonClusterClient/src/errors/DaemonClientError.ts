import { DaemonClientErrorCode } from './error-codes';

export class DaemonClientError extends Error {
    public readonly code: DaemonClientErrorCode;
    public readonly cause?: unknown;

    constructor(code: DaemonClientErrorCode, message: string, cause?: unknown) {
        super(message);
        this.name = 'DaemonClientError';
        this.code = code;
        this.cause = cause;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DaemonClientError);
        }
    }

    static enrollmentFailed(message: string, cause?: unknown): DaemonClientError {
        return new DaemonClientError(DaemonClientErrorCode.EnrollmentFailed, message, cause);
    }

    static socketConnectionFailed(message: string, cause?: unknown): DaemonClientError {
        return new DaemonClientError(DaemonClientErrorCode.SocketConnectionFailed, message, cause);
    }

    static commandTimeout(command: string): DaemonClientError {
        return new DaemonClientError(
            DaemonClientErrorCode.CommandTimeout,
            `Timed out waiting for response to command "${command}"`
        );
    }

    static commandRejected(command: string, serverMessage?: string): DaemonClientError {
        return new DaemonClientError(
            DaemonClientErrorCode.CommandRejected,
            serverMessage || `Command "${command}" was rejected by the server`
        );
    }

    static socketNotReady(): DaemonClientError {
        return new DaemonClientError(
            DaemonClientErrorCode.SocketNotReady,
            'Control socket is not connected or not yet registered'
        );
    }

    static handlerError(command: string, cause?: unknown): DaemonClientError {
        return new DaemonClientError(
            DaemonClientErrorCode.HandlerError,
            `Handler for command "${command}" threw an unhandled error`,
            cause
        );
    }

    static emitFailed(): DaemonClientError {
        return new DaemonClientError(
            DaemonClientErrorCode.EmitFailed,
            'Cannot emit message: control socket is not connected'
        );
    }

    static heartbeatFailed(cause?: unknown): DaemonClientError {
        const detail = cause instanceof Error ? cause.message : String(cause);
        return new DaemonClientError(
            DaemonClientErrorCode.HeartbeatFailed,
            `Heartbeat failed: ${detail}`,
            cause
        );
    }
};
