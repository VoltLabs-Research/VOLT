import { MinioService, RedisExplorerReadService } from '@/modules/platform/services';
import { RemoteExplorerTarget } from '@/shared/contracts';
import { TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND } from '@/shared/contracts/reverseChannel';
import { readRemoteExplorerRequest } from './payloadValidation';
import { buildMinioDownloadResponse, buildMinioEntries, buildMinioNode } from './remote-access/minioRemoteAccess';
import { buildMongoDownloadResponse, buildMongoEntries, buildMongoNode } from './remote-access/mongoRemoteAccess';
import { buildRedisDownloadResponse, buildRedisEntries, buildRedisNode } from './remote-access/redisRemoteAccess';
import { joinExplorerPathSegments } from './remote-access/shared';
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
        command: TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND.list,
        execute: async (payload) => {
            const request = readRemoteExplorerRequest(payload);
            return executeRemoteAccessAction(request.target, {
                [RemoteExplorerTarget.MongoDocuments]: async () => ({ data: await buildMongoEntries() }),
                [RemoteExplorerTarget.RedisData]: async () => ({
                    data: await buildRedisEntries(deps.redisExplorerReadService, request.path)
                }),
                [RemoteExplorerTarget.Minio]: async () => ({
                    data: await buildMinioEntries(deps.minioService, request.path)
                })
            }, `Unsupported remote explorer target: ${request.target}`);
        }
    },
    {
        command: TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND.node,
        execute: async (payload) => {
            const request = readRemoteExplorerRequest(payload);
            return executeRemoteAccessAction(request.target, {
                [RemoteExplorerTarget.MongoDocuments]: async () => ({ data: await buildMongoNode(request.path) }),
                [RemoteExplorerTarget.RedisData]: async () => ({
                    data: await buildRedisNode(deps.redisExplorerReadService, request.path)
                }),
                [RemoteExplorerTarget.Minio]: async () => ({
                    data: await buildMinioNode(deps.minioService, request.path)
                })
            }, `Unsupported remote explorer target: ${request.target}`);
        }
    },
    {
        command: TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND.download,
        execute: async (payload) => {
            const request = readRemoteExplorerRequest(payload);
            return executeRemoteAccessAction(request.target, {
                [RemoteExplorerTarget.MongoDocuments]: () => buildMongoDownloadResponse(request.path),
                [RemoteExplorerTarget.RedisData]: () => buildRedisDownloadResponse(
                    deps.redisExplorerReadService,
                    request.path
                ),
                [RemoteExplorerTarget.Minio]: () => buildMinioDownloadResponse(deps.minioService, request.path)
            }, `Unsupported remote explorer download target: ${request.target}`);
        }
    }
];

export { joinExplorerPathSegments };
