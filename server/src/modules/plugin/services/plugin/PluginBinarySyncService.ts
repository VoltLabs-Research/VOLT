import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import objectGatewayClientSingleton from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import type { Plugin } from '@modules/plugin/contracts/plugin';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import redisClient from '@shared/infrastructure/redis/redisClient';

const SYNC_CACHE_TTL_SECONDS = 600;
const SYNC_CACHE_PREFIX = 'plugin-sync:';

interface DaemonPluginSyncResponse {
    synced: boolean;
}

/**
 * Makes a plugin binary reachable from the compute cluster that is about to run
 * it, by asking that cluster's daemon to pull the object from its owner cluster.
 * Successful syncs are remembered in redis and concurrent requests for the same
 * binary share a single daemon round trip.
 */
class PluginBinarySyncService {
    private readonly objectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClientSingleton;

    private readonly teamClusterDaemonClient = teamClusterDaemonClient;

    private readonly redis = redisClient;

    private readonly inflightSyncs = new Map<string, Promise<void>>();

    async syncIfNeeded(teamClusterId: string, plugin: Plugin, ownerClusterId: string): Promise<void> {
        const entrypoint = plugin.props.workflow.entrypoint;
        const objectKey = entrypoint?.binaryObjectPath;
        if (!entrypoint || !objectKey) {
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                `Plugin ${plugin.id} is missing an uploaded entrypoint binary`
            );
        }

        const expectedHash = entrypoint.binaryHash ?? await this.readObjectSha256(ownerClusterId, objectKey);
        const syncKey = `${teamClusterId}:${ownerClusterId}:${plugin.id}:${objectKey}:${expectedHash ?? 'unknown-hash'}`;
        const redisKey = `${SYNC_CACHE_PREFIX}${syncKey}`;

        try {
            const cached = await this.redis.get(redisKey);
            if (cached === '1') {
                return;
            }
        } catch (error: unknown) {
            logger.warn({
                err: error,
                syncKey
            }, '@plugin-execution-router: plugin sync cache read failed');
        }

        const existingSync = this.inflightSyncs.get(syncKey);
        if (existingSync) {
            return existingSync;
        }

        const pendingSync = (async () => {
            const syncResponse = await this.teamClusterDaemonClient.command<DaemonPluginSyncResponse>(
                teamClusterId,
                ChannelCommands.PluginSync,
                {
                    pluginId: plugin.id,
                    objectKey,
                    ownerClusterId,
                    expectedHash
                },
                { timeoutClass: 'long-running-control-plane' }
            );

            if (!syncResponse.synced) {
                throw ApplicationError.conflict(
                    ErrorCodes.PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE,
                    `Plugin binary is not reachable from compute cluster: ${objectKey}`
                );
            }

            try {
                await this.redis.setex(redisKey, SYNC_CACHE_TTL_SECONDS, '1');
            } catch (error: unknown) {
                logger.warn({
                    err: error,
                    syncKey
                }, '@plugin-execution-router: plugin sync cache write failed');
            }
        })().finally(() => {
            this.inflightSyncs.delete(syncKey);
        });

        this.inflightSyncs.set(syncKey, pendingSync);
        return pendingSync;
    }

    private async readObjectSha256(ownerClusterId: string, objectKey: string): Promise<string | undefined> {
        try {
            const objectHead = await this.objectGatewayClient.head(ownerClusterId, TEAM_CLUSTER_BUCKETS.PLUGINS, objectKey);
            return objectHead.metadata.sha256 || undefined;
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                throw ApplicationError.conflict(
                    ErrorCodes.PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE,
                    `Plugin binary is missing from storage: ${objectKey}`
                );
            }

            throw new ApplicationError(
                ErrorCodes.PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE,
                `Failed to inspect plugin binary in storage: ${objectKey}`,
                503
            );
        }
    }
}

export default new PluginBinarySyncService();
