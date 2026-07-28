import { RemoteExplorerTarget, type RemoteExplorerEntry, type RemoteExplorerNode } from '@shared/contracts';
import type { ReverseChannelCommandResult } from '@shared/contracts/channel/reverse-channel-messaging';

export default abstract class BaseRemoteAccess {
    abstract readonly target: RemoteExplorerTarget;

    abstract list(path: string): Promise<RemoteExplorerEntry[]>;

    abstract node(path: string): Promise<RemoteExplorerNode>;

    abstract download(path: string): Promise<ReverseChannelCommandResult>;
};
