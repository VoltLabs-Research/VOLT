import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type ClusterTransferJobRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/ClusterTransferJobRepository';
import type StoragePlacementRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementRepository)
        private readonly storagePlacementRepository: StoragePlacementRepository,

        @inject(TEAM_CLUSTER_TOKENS.ClusterTransferJobRepository)
        private readonly clusterTransferJobRepository: ClusterTransferJobRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
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
