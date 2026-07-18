import type { IStoragePlacementRepository } from '@modules/cluster/ports/IStoragePlacementRepository';
import type { ITeamClusterRepository } from '@modules/cluster/ports/ITeamClusterRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import type { IClusterTransferJobRepository } from '@modules/cluster/ports/IClusterTransferJobRepository';
import type { ITeamClusterLifecycleService } from '@modules/cluster/ports/ITeamClusterLifecycleService';
import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import { TeamClusterStatus } from '@modules/cluster/entities/TeamCluster';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(CLUSTER_TOKENS.TeamClusterLifecycleService) private readonly teamClusterLifecycleService: ITeamClusterLifecycleService,
        @inject(CLUSTER_TOKENS.StoragePlacementRepository) private readonly storagePlacementRepository: IStoragePlacementRepository,
        @inject(CLUSTER_TOKENS.ClusterTransferJobRepository) private readonly clusterTransferJobRepository: IClusterTransferJobRepository,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly teamClusterDaemonClient: ITeamClusterDaemonClient
    ) {}

    async handle(event: TeamDeletedEvent): Promise<void> {
        const { teamId, userId } = event.payload;

        const teamClusters = await this.teamClusterRepository.export({
            filter: { team: teamId }
        });

        for (const teamCluster of teamClusters) {
            if (teamCluster.props.status === TeamClusterStatus.Connected) {
                try {
                    await this.teamClusterDaemonClient.command(
                        teamCluster.id,
                        ChannelCommands.RuntimeUninstall,
                        {
                            reason: userId
                                ? `Team deletion requested by user ${userId}`
                                : 'Team deletion cascade'
                        },
                        { timeoutClass: 'long-running-control-plane' }
                    );
                } catch (error) {
                    logger.warn(
                        error,
                        `[TeamDeletedEventHandler] Failed to request remote uninstall for teamCluster ${teamCluster.id}`
                    );
                }
            }

            try {
                await this.teamClusterLifecycleService.deleteTeamCluster(teamCluster);
            } catch (error) {
                logger.warn(
                    error,
                    `[TeamDeletedEventHandler] Failed to delete teamCluster ${teamCluster.id} on team.deleted`
                );
            }
        }

        await Promise.all([
            this.storagePlacementRepository.deleteMany({ team: teamId }),
            this.clusterTransferJobRepository.deleteMany({ team: teamId })
        ]);
    }
}
