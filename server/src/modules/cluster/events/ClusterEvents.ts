import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import teamClusterLifecycleService from '@modules/cluster/services/TeamClusterLifecycleService';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike } from '@modules/cluster/contracts/team-cluster';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import ClusterTransferJob from '@modules/cluster/models/ClusterTransferJob';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';

@DefineEventGroup('cluster')
export default class ClusterEvents {
    @Event('team.deleted')
    async deleteTeamClusters({ teamId, userId }: EventMap['team.deleted']) {
        const teamClusterEntities = await TeamClusterEntity.findBy({ team: teamId });
        const teamClusters = teamClusterEntities.map(toTeamClusterLike);

        for (const teamCluster of teamClusters) {
            if (teamCluster.props.status === TeamClusterStatus.Connected) {
                try {
                    await teamClusterDaemonClient.command(
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
                        `[ClusterEvents] Failed to request remote uninstall for teamCluster ${teamCluster.id}`
                    );
                }
            }

            try {
                await teamClusterLifecycleService.deleteTeamCluster(teamCluster);
            } catch (error) {
                logger.warn(
                    error,
                    `[ClusterEvents] Failed to delete teamCluster ${teamCluster.id} on team.deleted`
                );
            }
        }

        await Promise.all([
            StoragePlacement.delete({ team: teamId }),
            ClusterTransferJob.delete({ team: teamId })
        ]);
    }
}
