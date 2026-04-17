import { CommandError } from '@/core/commands/CommandError';

export class DaemonCommandError extends CommandError {
    constructor(code: string, message: string, statusCode: number) {
        super(code, message, statusCode);
        this.name = 'DaemonCommandError';
    }
}

export namespace DaemonCommandError {
    export let badRequest: (code: string, message: string) => DaemonCommandError;
    export let conflict: (code: string, message: string) => DaemonCommandError;
    export let unprocessableEntity: (code: string, message: string) => DaemonCommandError;

    badRequest = function(code: string, message: string): DaemonCommandError {
        return new DaemonCommandError(code, message, 400);
    };

    conflict = function(code: string, message: string): DaemonCommandError {
        return new DaemonCommandError(code, message, 409);
    };

    unprocessableEntity = function(code: string, message: string): DaemonCommandError {
        return new DaemonCommandError(code, message, 422);
    };
}
