import { getFilesystemObjectStore } from '@shared/storage/FilesystemObjectStore';
import { Command, commandGroupFactory } from '@shared/commands/command';
import type { FilesystemObjectStore } from '@shared/storage/FilesystemObjectStore';
import BaseRemoteAccess from '@modules/system/services/remote-access/BaseRemoteAccess';
import ObjectStoreRemoteAccess from '@modules/system/services/remote-access/ObjectStoreRemoteAccess';
import DaemonTableRemoteAccess from '@modules/system/services/remote-access/DaemonTableRemoteAccess';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';
import {
    type TeamClusterRemoteExplorerRequest,
    TeamClusterRemoteAccessTarget
} from '@volt/contracts/modules/cluster/domain';

export class RemoteCommands {
    private readonly remoteAccessByTarget: Map<TeamClusterRemoteAccessTarget, BaseRemoteAccess>;

    constructor(private readonly objectStore: FilesystemObjectStore) {
        const remoteAccesses = [
            new DaemonTableRemoteAccess(),
            new ObjectStoreRemoteAccess(this.objectStore)
        ];

        this.remoteAccessByTarget = new Map(remoteAccesses.map((remoteAccess) => [remoteAccess.target, remoteAccess]));
    }

    @Command(DaemonCommand.RemoteExplorerList)
    async list(payload: TeamClusterRemoteExplorerRequest) {
        return this.getRemoteAccess(payload.target).list(payload.path);
    }

    @Command(DaemonCommand.RemoteExplorerNode)
    async node(payload: TeamClusterRemoteExplorerRequest) {
        return this.getRemoteAccess(payload.target).node(payload.path);
    }

    @Command(DaemonCommand.RemoteExplorerDownload, { raw: true })
    async download(payload: TeamClusterRemoteExplorerRequest) {
        return this.getRemoteAccess(payload.target).download(payload.path);
    }

    private getRemoteAccess(target: TeamClusterRemoteAccessTarget): BaseRemoteAccess {
        const remoteAccess = this.remoteAccessByTarget.get(target);
        if (!remoteAccess) {
            throw new Error(`Unsupported remote explorer target: ${target}`);
        }

        return remoteAccess;
    }
}

export const getRemoteCommands = commandGroupFactory(RemoteCommands, () => new RemoteCommands(getFilesystemObjectStore()));
