export class CommandError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly statusCode: number
    ) {
        super(message);
        this.name = 'CommandError';
    }
}

export namespace CommandError {
    export let badRequest: (code: string, message: string) => CommandError;
    export let conflict: (code: string, message: string) => CommandError;
    export let notFound: (code: string, message: string) => CommandError;
    export let unprocessableEntity: (code: string, message: string) => CommandError;

    badRequest = function(code: string, message: string): CommandError {
        return new CommandError(code, message, 400);
    };

    conflict = function(code: string, message: string): CommandError {
        return new CommandError(code, message, 409);
    };

    notFound = function(code: string, message: string): CommandError {
        return new CommandError(code, message, 404);
    };

    unprocessableEntity = function(code: string, message: string): CommandError {
        return new CommandError(code, message, 422);
    };
}
