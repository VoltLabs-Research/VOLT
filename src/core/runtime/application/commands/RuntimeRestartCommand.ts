import { BaseCommand } from '@/core/commands/BaseCommand';
import { ChannelCommands } from '@/core/reverse-channel/contracts/reverseChannel.constants';

const DEFERRED_RUNTIME_COMMAND_DELAY_MS = 250;

export class RuntimeRestartCommand extends BaseCommand<undefined> {
    static readonly commandName = ChannelCommands.RuntimeRestart;

    execute() {
        const delay = DEFERRED_RUNTIME_COMMAND_DELAY_MS;
        const accepted = { accepted: true };

        setTimeout(() => {
            process.exit(0);
        }, delay);

        return {
            data: accepted
        };
    }
}
