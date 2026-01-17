export default class ApplicationError extends Error {
    constructor(
        public readonly code: string,
        public readonly message: string,
        public readonly statusCode: number = 500,
        public readonly isOperational: boolean = true
    ) {
        super(message);
    }

    public static badRequest(code: string, message: string): ApplicationError {
        return new ApplicationError(code, message, 400);
    }

    public static unauthorized(code: string, message: string): ApplicationError {
        return new ApplicationError(code, message, 401);
    }

    public static forbidden(code: string, message: string): ApplicationError {
        return new ApplicationError(code, message, 403);
    }

    public static notFound(code: string, message: string): ApplicationError {
        return new ApplicationError(code, message, 404);
    }

    public static conflict(code: string, message: string): ApplicationError {
        return new ApplicationError(code, message, 409);
    }

    public static internalServerError(message: string): ApplicationError {
        return new ApplicationError('INTERNAL_SERVER_ERROR', message, 500);
    }
};