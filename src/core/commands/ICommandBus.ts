interface CommandResult {
    status?: number;
    data?: object | null;
    body?: Buffer;
    headers?: Record<string, string>;
    stream?: ReadableStream<Uint8Array>;
}

interface Command<TResult = CommandResult> {
    execute(): Promise<TResult> | TResult;
}

export interface CommandRegistration<TCommand extends Command<CommandResult> = Command<CommandResult>> {
    readonly commandName: string;
    readonly createCommand: (payload: object | undefined) => TCommand;
}

export interface ICommandBus {
    dispatch(commandName: string, payload: object | undefined): Promise<CommandResult>;
    getCommandNames(): string[];
    register<TCommand extends Command<CommandResult>>(registration: CommandRegistration<TCommand>): Promise<void>;
}
