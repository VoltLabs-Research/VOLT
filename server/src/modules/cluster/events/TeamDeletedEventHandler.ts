import type {
    IStoragePlacementRepository,
    ITeamClusterRepository,
    IClusterTransferJobRepository
} from '@shared/contracts/ports';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { container as diContainer } from 'tsyringe';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import teamClusterLifecycleService from '@modules/cluster/services/TeamClusterLifecycleService';
import TeamClusterRepository from '@modules/cluster/repositories/TeamClusterRepository';
import StoragePlacementRepository from '@modules/cluster/repositories/StoragePlacementRepository';
import ClusterTransferJobRepository from '@modules/cluster/repositories/ClusterTransferJobRepository';
import { TeamClusterStatus } from '@modules/cluster/entities/TeamCluster';
import TeamDeletedEvent from '@modules/team/events/team/TeamDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent> {
    private readonly teamClusterRepository: ITeamClusterRepository = new TeamClusterRepository();
    private readonly teamClusterLifecycleService = teamClusterLifecycleService;
    private readonly storagePlacementRepository: IStoragePlacementRepository = new StoragePlacementRepository();
    private readonly clusterTransferJobRepository: IClusterTransferJobRepository = new ClusterTransferJobRepository();

    #teamClusterDaemonClientCache?: ITeamClusterDaemonClient;
    private get teamClusterDaemonClient(): ITeamClusterDaemonClient {
        return (this.#teamClusterDaemonClientCache ??= diContainer.resolve<ITeamClusterDaemonClient>(SHARED_TOKENS.TeamClusterDaemonClient));
    }

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
