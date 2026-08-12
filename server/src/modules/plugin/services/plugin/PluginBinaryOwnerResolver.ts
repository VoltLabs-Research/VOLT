import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import storagePlacementService from '@modules/cluster/services/storage/StoragePlacementService';
import objectGatewayClientSingleton from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import type { Plugin } from '@modules/plugin/contracts/plugin';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IStoragePlacementService } from '@shared/contracts/ports/IStoragePlacementService';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports/ITeamClusterObjectGatewayClient';
import logger from '@shared/infrastructure/logger';

class PluginBinaryOwnerResolver {
    private readonly storagePlacementService: IStoragePlacementService = storagePlacementService;

    private readonly objectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClientSingleton;

    async resolveOwnerClusterId(plugin: Plugin): Promise<string> {
        const placement = await this.storagePlacementService.ensurePlacement('plugin-binary', plugin.id);
        const currentOwnerClusterId = placement.props.primaryClusterId;
        const objectKey = plugin.props.workflow.entrypoint?.binaryObjectPath;

        if (!objectKey) {
            return currentOwnerClusterId;
        }

        if (await this.binaryExists(currentOwnerClusterId, objectKey)) {
            return currentOwnerClusterId;
        }

        const teamClusters = await TeamCluster.findBy({ team: plugin.props.team });

        for (const candidateCluster of teamClusters) {
            if (candidateCluster.id === currentOwnerClusterId) {
                continue;
            }

            if (!(await this.binaryExists(candidateCluster.id, objectKey))) {
                continue;
            }

            await this.storagePlacementService.switchPrimaryCluster(
                'plugin-binary',
                plugin.id,
                candidateCluster.id,
                {
                    replicaClusterIds: placement.props.replicaClusterIds,
                    state: placement.props.state,
                    lastVerifiedAt: new Date()
                }
            );

            logger.warn(
                {
                    pluginId: plugin.id,
                    objectKey,
                    previousOwnerClusterId: currentOwnerClusterId,
                    repairedOwnerClusterId: candidateCluster.id
                },
                '@plugin-execution-router: repaired plugin binary storage placement owner'
            );

            return candidateCluster.id;
        }

        return currentOwnerClusterId;
    }

    private async binaryExists(ownerClusterId: string, objectKey: string): Promise<boolean> {
        try {
            await this.objectGatewayClient.head(ownerClusterId, TEAM_CLUSTER_BUCKETS.PLUGINS, objectKey);
            return true;
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return false;
            }

            logger.warn(
                {
                    err: error,
                    ownerClusterId,
                    objectKey
                },
                '@plugin-execution-router: failed to inspect plugin binary while resolving owner'
            );
            return false;
        }
    }
}

export default new PluginBinaryOwnerResolver();
