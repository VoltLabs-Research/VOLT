import teamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import teamClusterLifecycleService from '@modules/cluster/services/TeamClusterLifecycleService';
import TeamClusterModel, { toTeamClusterLike } from '@modules/cluster/models/TeamClusterModel';
import StoragePlacementModel from '@modules/cluster/models/StoragePlacementModel';
import ClusterTransferJobModel from '@modules/cluster/models/ClusterTransferJobModel';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';
import logger from '@shared/infrastructure/logger';

class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    private readonly teamClusterLifecycleService = teamClusterLifecycleService;

        private readonly teamClusterDaemonClient = teamClusterDaemonClient;

    async handle(event: TeamDeletedEvent): Promise<void> {
        const { teamId, userId } = event.payload;

        const teamClusterDocuments = await TeamClusterModel.find({ team: teamId }).exec();
        const teamClusters = teamClusterDocuments.map(toTeamClusterLike);

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
            StoragePlacementModel.deleteMany({ team: teamId }).exec(),
            ClusterTransferJobModel.deleteMany({ team: teamId }).exec()
        ]);
    }
}

const teamDeletedEventHandler = new TeamDeletedEventHandler();
subscribeHandler('team.deleted', teamDeletedEventHandler);

export default teamDeletedEventHandler;
