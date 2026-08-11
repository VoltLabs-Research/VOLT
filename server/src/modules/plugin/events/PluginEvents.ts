import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import { cascadeDeleteEach } from '@shared/events/cascadeDeleteEach';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import type { IStoragePlacementService } from '@shared/contracts/ports/IStoragePlacementService';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import storagePlacementService from '@modules/cluster/services/storage/StoragePlacementService';
import PluginEntity from '@modules/plugin/models/Plugin';
import PluginService from '@modules/plugin/services/PluginService';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import { SceneArtifactSourceType } from '@shared/contracts/types/SceneArtifact';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';
import logger from '@shared/infrastructure/logger';

interface PluginWarmupCommandPayload extends Record<string, unknown> {
    pluginId: string;
    binaryObjectPath: string;
    requirementsFile: string;
    entrypointScript?: string;
    expectedHash?: string;
    ownerClusterId: string;
}

interface PluginWarmupCommandResponse {
    queued: boolean;
    jobId: string;
}

@DefineEventGroup('plugin')
export default class PluginEvents {
    #storagePlacementService: IStoragePlacementService = storagePlacementService;
    #service?: PluginService;

    @Event('plugin.deleted')
    async deletePluginExposures({ pluginId }: EventMap['plugin.deleted']) {
        await SceneArtifact.delete({
            plugin: pluginId,
            sourceType: SceneArtifactSourceType.PluginExposure
        });
    }

    @Event('plugin.published')
    async warmupPluginBinaries(payload: EventMap['plugin.published']) {
        const { pluginId, teamId, binaryObjectPath, requirementsFile, entrypointScript, binaryHash } = payload;

        if (!binaryObjectPath || requirementsFile === undefined) {
            logger.debug({ pluginId }, '@plugin-published-event-handler: skipping warmup, plugin has no python binary');
            return;
        }

        const teamClusters = await TeamCluster.findBy({ team: teamId });

        if (!teamClusters.length) {
            logger.info({
                pluginId,
                teamId
            }, '@plugin-published-event-handler: no clusters attached to team yet');
            return;
        }

        const warmupPayload: PluginWarmupCommandPayload = {
            pluginId,
            binaryObjectPath,
            requirementsFile,
            entrypointScript,
            expectedHash: binaryHash,
            ownerClusterId: (await this.#storagePlacementService.ensurePlacement('plugin-binary', pluginId)).props.primaryClusterId
        };

        await Promise.allSettled(teamClusters.map(async (cluster) => {
            try {
                const response = await teamClusterDaemonClient.command<PluginWarmupCommandResponse>(
                    cluster.id,
                    ChannelCommands.PluginWarmup,
                    warmupPayload,
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'idempotent-command'
                    }
                );
                logger.info(
                    {
                        pluginId,
                        teamClusterId: cluster.id,
                        queued: response.queued,
                        warmupJobId: response.jobId
                    },
                    '@plugin-published-event-handler: plugin warmup queued'
                );
            } catch (error: unknown) {
                logger.warn(
                    {
                        err: error,
                        pluginId,
                        teamClusterId: cluster.id
                    },
                    '@plugin-published-event-handler: failed to enqueue plugin warmup'
                );
            }
        }));
    }

    @Event('team.deleted')
    async deleteTeamPlugins({ teamId }: EventMap['team.deleted']) {
        const plugins = await PluginEntity.find({
            where: { team: teamId },
            select: { id: true }
        });

        await cascadeDeleteEach({
            label: 'PluginEvents',
            ids: plugins.map((plugin) => plugin.id),
            deleteOne: async (pluginId) => {
                this.#service ??= new PluginService();
                await this.#service.deletePluginById({ pluginId });
            }
        });
    }

    @Event('trajectory.deleted')
    async deleteTrajectoryExposures({ trajectoryId }: EventMap['trajectory.deleted']) {
        await SceneArtifact.delete({
            trajectory: trajectoryId,
            sourceType: SceneArtifactSourceType.PluginExposure
        });
    }
}
