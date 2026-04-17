import { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import { RedisExplorerReadService } from '@/modules/container/infrastructure/remote-access/RedisExplorerReadService';
import { RemoteExplorerTarget, type RemoteExplorerRequest } from '@/contracts';
import { ChannelCommands } from '@/core/reverse-channel/contracts/reverseChannel.constants';
import { buildMinioDownloadResponse, buildMinioEntries, buildMinioNode } from '@/modules/container/infrastructure/remote-access/minioRemoteAccess';
import { buildMongoDownloadResponse, buildMongoEntries, buildMongoNode } from '@/modules/container/infrastructure/remote-access/mongoRemoteAccess';
import { buildRedisDownloadResponse, buildRedisEntries, buildRedisNode } from '@/modules/container/infrastructure/remote-access/redisRemoteAccess';
import type { ReverseChannelCommandHandler, ReverseChannelCommandResult } from '@/core/reverse-channel/contracts/commandHandler';

interface RemoteAccessHandlersDependencies {
    minioService: MinioService;
    redisExplorerReadService: RedisExplorerReadService;
}

const readRemoteExplorerCommandInput = (payload: unknown): {
    target: RemoteExplorerTarget;
    path: string;
} => {
    const request = payload as RemoteExplorerRequest;

    return {
        target: request.target,
        path: request.path ?? ''
    };
};

export const createRemoteAccessHandlers = (deps: RemoteAccessHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: ChannelCommands.RemoteExplorerList,
        execute: async (payload) => {
            const request = readRemoteExplorerCommandInput(payload);

            switch (request.target) {
                case RemoteExplorerTarget.MongoDocuments:
                    return { data: await buildMongoEntries() };
                case RemoteExplorerTarget.RedisData:
                    return {
                        data: await buildRedisEntries(deps.redisExplorerReadService, request.path)
                    };
                case RemoteExplorerTarget.Minio:
                    return {
                        data: await buildMinioEntries(deps.minioService, request.path)
                    };
                default:
                    throw new Error(`Unsupported remote explorer target: ${request.target}`);
            }
        }
    },
    {
        command: ChannelCommands.RemoteExplorerNode,
        execute: async (payload) => {
            const request = readRemoteExplorerCommandInput(payload);

            switch (request.target) {
                case RemoteExplorerTarget.MongoDocuments:
                    return { data: await buildMongoNode(request.path) };
                case RemoteExplorerTarget.RedisData:
                    return {
                        data: await buildRedisNode(deps.redisExplorerReadService, request.path)
                    };
                case RemoteExplorerTarget.Minio:
                    return {
                        data: await buildMinioNode(deps.minioService, request.path)
                    };
                default:
                    throw new Error(`Unsupported remote explorer target: ${request.target}`);
            }
        }
    },
    {
        command: ChannelCommands.RemoteExplorerDownload,
        execute: async (payload) => {
            const request = readRemoteExplorerCommandInput(payload);

            switch (request.target) {
                case RemoteExplorerTarget.MongoDocuments:
                    return buildMongoDownloadResponse(request.path);
                case RemoteExplorerTarget.RedisData:
                    return buildRedisDownloadResponse(
                        deps.redisExplorerReadService,
                        request.path
                    );
                case RemoteExplorerTarget.Minio:
                    return buildMinioDownloadResponse(deps.minioService, request.path);
                default:
                    throw new Error(`Unsupported remote explorer download target: ${request.target}`);
            }
        }
    }
];
