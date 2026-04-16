import { MinioService, RedisExplorerReadService } from '@/modules/platform/services';
import { RemoteExplorerTarget, type RemoteExplorerRequest } from '@/shared/contracts';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts/reverseChannel';
import { buildMinioDownloadResponse, buildMinioEntries, buildMinioNode } from './remote-access/minioRemoteAccess';
import { buildMongoDownloadResponse, buildMongoEntries, buildMongoNode } from './remote-access/mongoRemoteAccess';
import { buildRedisDownloadResponse, buildRedisEntries, buildRedisNode } from './remote-access/redisRemoteAccess';
import type { ReverseChannelCommandHandler, ReverseChannelCommandResult } from '../services';

interface RemoteAccessHandlersDependencies {
    minioService: MinioService;
    redisExplorerReadService: RedisExplorerReadService;
}

type RemoteAccessActionMap = Partial<Record<RemoteExplorerTarget, () => Promise<ReverseChannelCommandResult>>>;

const executeRemoteAccessAction = async (
    target: RemoteExplorerTarget,
    actionMap: RemoteAccessActionMap,
    unsupportedMessage: string
): Promise<ReverseChannelCommandResult> => {
    const execute = actionMap[target];
    if (!execute) {
        throw new Error(unsupportedMessage);
    }

    return execute();
};

export const createRemoteAccessHandlers = (deps: RemoteAccessHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.remoteExplorer.list,
        execute: async (payload) => {
            const request = payload as RemoteExplorerRequest;
            const path = request.path ?? '';
            return executeRemoteAccessAction(request.target, {
                [RemoteExplorerTarget.MongoDocuments]: async () => ({ data: await buildMongoEntries() }),
                [RemoteExplorerTarget.RedisData]: async () => ({
                    data: await buildRedisEntries(deps.redisExplorerReadService, path)
                }),
                [RemoteExplorerTarget.Minio]: async () => ({
                    data: await buildMinioEntries(deps.minioService, path)
                })
            }, `Unsupported remote explorer target: ${request.target}`);
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.remoteExplorer.node,
        execute: async (payload) => {
            const request = payload as RemoteExplorerRequest;
            const path = request.path ?? '';
            return executeRemoteAccessAction(request.target, {
                [RemoteExplorerTarget.MongoDocuments]: async () => ({ data: await buildMongoNode(path) }),
                [RemoteExplorerTarget.RedisData]: async () => ({
                    data: await buildRedisNode(deps.redisExplorerReadService, path)
                }),
                [RemoteExplorerTarget.Minio]: async () => ({
                    data: await buildMinioNode(deps.minioService, path)
                })
            }, `Unsupported remote explorer target: ${request.target}`);
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.remoteExplorer.download,
        execute: async (payload) => {
            const request = payload as RemoteExplorerRequest;
            const path = request.path ?? '';
            return executeRemoteAccessAction(request.target, {
                [RemoteExplorerTarget.MongoDocuments]: () => buildMongoDownloadResponse(path),
                [RemoteExplorerTarget.RedisData]: () => buildRedisDownloadResponse(
                    deps.redisExplorerReadService,
                    path
                ),
                [RemoteExplorerTarget.Minio]: () => buildMinioDownloadResponse(deps.minioService, path)
            }, `Unsupported remote explorer download target: ${request.target}`);
        }
    }
];
