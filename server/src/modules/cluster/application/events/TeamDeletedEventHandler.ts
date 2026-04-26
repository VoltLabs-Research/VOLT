import { TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
import ClusterTransferJobRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/ClusterTransferJobRepository';
import StoragePlacementRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterLifecycleService from '@modules/cluster/infrastructure/services/TeamClusterLifecycleService';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    constructor(
        
        private readonly teamClusterRepository: TeamClusterRepository,

        
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        
        private readonly storagePlacementRepository: StoragePlacementRepository,

        
        private readonly clusterTransferJobRepository: ClusterTransferJobRepository,

        
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
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
};
