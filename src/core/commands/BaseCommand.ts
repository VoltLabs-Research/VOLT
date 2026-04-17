import type { ICommand, ICommandResult } from '@/core/commands/ICommand';

export abstract class BaseCommand<TPayload, TResult = ICommandResult> implements ICommand<TResult> {
    public static readonly commandName: string;
    public readonly name: string;
    public readonly payload: TPayload;

    protected constructor(payload: TPayload) {
        this.name = (this.constructor as typeof BaseCommand).commandName;
        this.payload = payload;
    }

}
