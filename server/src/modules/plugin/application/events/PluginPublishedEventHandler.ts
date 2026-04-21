import PluginPublishedEvent from '@modules/plugin/domain/events/PluginPublishedEvent';

import { ChannelCommands, VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

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

@injectable()
export default class PluginPublishedEventHandler implements IEventHandler<PluginPublishedEvent> {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
    ){}

    async handle(event: PluginPublishedEvent): Promise<void> {
        const { pluginId, teamId, binaryObjectPath, requirementsFile, entrypointScript, binaryHash } = event.payload;

        if (!binaryObjectPath || requirementsFile === undefined) {
            logger.debug({ pluginId }, '@plugin-published-event-handler: skipping warmup, plugin has no python binary');
            return;
        }

        const teamClusters = await this.teamClusterRepository.export({
            filter: { team: teamId } as Record<string, unknown>
        });

        if (!teamClusters.length) {
            logger.info({ pluginId, teamId }, '@plugin-published-event-handler: no clusters attached to team yet');
            return;
        }

        const warmupPayload: PluginWarmupCommandPayload = {
            pluginId,
            binaryObjectPath,
            requirementsFile,
            entrypointScript,
            expectedHash: binaryHash,
            ownerClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID
        };

        await Promise.allSettled(teamClusters.map(async (cluster) => {
            try {
                const response = await this.teamClusterDaemonClient.command<PluginWarmupCommandResponse>(
                    cluster._id,
                    ChannelCommands.PluginWarmup,
                    warmupPayload,
                    { timeoutClass: 'long-running-control-plane', retryClass: 'idempotent-command' }
                );
                logger.info(
                    {
                        pluginId,
                        teamClusterId: cluster._id,
                        queued: response.queued,
                        warmupJobId: response.jobId
                    },
                    '@plugin-published-event-handler: plugin warmup queued'
                );
            } catch (error: unknown) {
                logger.warn(
                    { err: error, pluginId, teamClusterId: cluster._id },
                    '@plugin-published-event-handler: failed to enqueue plugin warmup'
                );
            }
        }));
    }
};
