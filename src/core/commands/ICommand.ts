export interface ICommandResult {
    status?: number;
    data?: object | null;
    body?: Buffer;
    headers?: Record<string, string>;
    stream?: ReadableStream<Uint8Array>;
}

export interface ICommand<TResult = ICommandResult> {
    execute(): Promise<TResult> | TResult;
}
