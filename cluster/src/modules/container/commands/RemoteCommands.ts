import { getFilesystemObjectStore } from '@shared/infrastructure/storage/FilesystemObjectStore';
import { RemoteExplorerTarget, type RemoteExplorerRequest } from '@shared/contracts/types/remote-explorer';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import type { FilesystemObjectStore } from '@shared/infrastructure/storage/FilesystemObjectStore';
import BaseRemoteAccess from '@modules/container/services/remote-access/BaseRemoteAccess';
import ObjectStoreRemoteAccess from '@modules/container/services/remote-access/ObjectStoreRemoteAccess';
import DaemonTableRemoteAccess from '@modules/container/services/remote-access/DaemonTableRemoteAccess';

@CommandGroup('remote')
export class RemoteCommands {
    private readonly remoteAccessByTarget: Map<RemoteExplorerTarget, BaseRemoteAccess>;

    constructor(private readonly objectStore: FilesystemObjectStore) {
        const remoteAccesses = [
            new DaemonTableRemoteAccess(),
            new ObjectStoreRemoteAccess(this.objectStore)
        ];

        this.remoteAccessByTarget = new Map(remoteAccesses.map((remoteAccess) => [remoteAccess.target, remoteAccess]));
    }

    @Command('explorer.list')
    async list(payload: RemoteExplorerRequest) {
        return this.getRemoteAccess(payload.target).list(payload.path);
    }

    @Command('explorer.node')
    async node(payload: RemoteExplorerRequest) {
        return this.getRemoteAccess(payload.target).node(payload.path);
    }

    @Command('explorer.download', { raw: true })
    async download(payload: RemoteExplorerRequest) {
        return this.getRemoteAccess(payload.target).download(payload.path);
    }

    private getRemoteAccess(target: RemoteExplorerTarget): BaseRemoteAccess {
        const remoteAccess = this.remoteAccessByTarget.get(target);
        if (!remoteAccess) {
            throw new Error(`Unsupported remote explorer target: ${target}`);
        }

        return remoteAccess;
    }
}

export const getRemoteCommands = commandGroupFactory(RemoteCommands, () => new RemoteCommands(getFilesystemObjectStore()));
