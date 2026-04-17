import { CommandError } from '@/core/commands/CommandError';
import type { ICommand } from '@/core/commands/ICommand';
import type { ICommandBus, CommandPayload, CommandRegistration, CommandResult } from '@/core/commands/ICommandBus';

export class InMemoryCommandBus implements ICommandBus {
    private readonly registrations = new Map<string, CommandRegistration>();

    constructor() {
        this.register = this.register.bind(this);
    }

    dispatch(commandName: string, payload: CommandPayload): Promise<CommandResult> {
        if (!this.getCommandNames().includes(commandName)) {
            throw CommandError.notFound(
                'COMMAND_NOT_REGISTERED',
                `Command not registered: ${commandName}`
            );
        }

        const registration = this.registrations.get(commandName);
        if (!registration) {
            throw CommandError.notFound(
                'COMMAND_NOT_REGISTERED',
                `Command not registered: ${commandName}`
            );
        }

        const command = registration.createCommand(payload) as ICommand;
        return Promise.resolve(command.execute());
    }

    getCommandNames(): string[] {
        const commandNames: string[] = [];
        for (const commandName of this.registrations.keys()) {
            commandNames.push(commandName);
        }

        return commandNames;
    }

    register<TCommand extends ICommand>(registration: CommandRegistration<TCommand>): Promise<void> {
        if (this.getCommandNames().includes(registration.commandName)) {
            throw new Error(`Command already registered: ${registration.commandName}`);
        }

        this.registrations.set(registration.commandName, registration as CommandRegistration);

        return Promise.resolve();
    }
}
