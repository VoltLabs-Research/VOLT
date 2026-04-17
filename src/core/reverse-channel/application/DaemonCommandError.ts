export class DaemonCommandError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode: number
    ) {
        super(message);
        this.name = 'DaemonCommandError';
    }

    static badRequest(code: string, message: string): DaemonCommandError {
        return new DaemonCommandError(code, message, 400);
    }

    static conflict(code: string, message: string): DaemonCommandError {
        return new DaemonCommandError(code, message, 409);
    }

    static unprocessableEntity(code: string, message: string): DaemonCommandError {
        return new DaemonCommandError(code, message, 422);
    }
}
