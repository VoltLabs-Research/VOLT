import type { ReverseChannelCommandResult } from '@shared/contracts/channel/reverse-channel-messaging';
import {
    type TeamClusterRemoteExplorerEntry,
    type TeamClusterRemoteExplorerNode,
    TeamClusterRemoteAccessTarget
} from '@volt/contracts/modules/cluster/domain';

export default abstract class BaseRemoteAccess {
    abstract readonly target: TeamClusterRemoteAccessTarget;

    abstract list(path: string): Promise<TeamClusterRemoteExplorerEntry[]>;

    abstract node(path: string): Promise<TeamClusterRemoteExplorerNode>;

    abstract download(path: string): Promise<ReverseChannelCommandResult>;
};
