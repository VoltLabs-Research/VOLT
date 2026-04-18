import { RemoteExplorerTarget, type RemoteExplorerRequest } from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import type { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import type { RedisExplorer } from '@/modules/container/infrastructure/remote-access/RedisExplorer';
import BaseRemoteAccess from '@/modules/container/infrastructure/remote-access/BaseRemoteAccess';
import MinioRemoteAccess from '@/modules/container/infrastructure/remote-access/MinIORemoteAccess';
import MongoRemoteAccess from '@/modules/container/infrastructure/remote-access/MongoRemoteAccess';
import RedisRemoteAccess from '@/modules/container/infrastructure/remote-access/RedisRemoteAccess';

@CommandGroup('remote')
export class RemoteCommands {
    private readonly remoteAccessByTarget: Map<RemoteExplorerTarget, BaseRemoteAccess>;

    constructor(
        private readonly minioService: MinioService,
        private readonly redisExplorer: RedisExplorer
    ) {
        const remoteAccesses = [
            new MongoRemoteAccess(),
            new RedisRemoteAccess(this.redisExplorer),
            new MinioRemoteAccess(this.minioService)
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
