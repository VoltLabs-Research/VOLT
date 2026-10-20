import type { ReverseChannelCommandExecutor } from '@shared/contracts/channel/reverse-channel-messaging';

export interface CommandTransport {
    registerCommand(commandName: string, execute: ReverseChannelCommandExecutor): void;
}
