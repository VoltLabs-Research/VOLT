import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import { cascadeDeleteEach } from '@shared/events/cascadeDeleteEach';
import ClusterTransferJob from '@modules/cluster/models/ClusterTransferJob';
import StoragePlacement from '@modules/cluster/models/StoragePlacement';
import { StoragePlacementScopeType } from '@modules/cluster/contracts/storage-placement';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryService from '@modules/trajectory/services/TrajectoryService';
import {
    getTrajectoryStorageCleanupTargets,
    type TrajectoryStorageCleanupTarget
} from '@shared/application/utilities/trajectory-storage-cleanup-prefixes';
import { JobStatus } from '@shared/contracts/types/JobStatus';
import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';
import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import logger from '@shared/infrastructure/logger';

const TRAJECTORY_LIFECYCLE_QUEUE_TYPES = new Set([
    'trajectory_glb_conversion',
    'trajectory_clone'
]);

@DefineEventGroup('trajectory')
export default class TrajectoryEvents {
    #service?: TrajectoryService;

    @Event('job.status.changed')
    async syncStatusFromJob({ status, queueType, teamId, trajectoryId }: EventMap['job.status.changed']) {
        if (!trajectoryId) return;
        if (!TRAJECTORY_LIFECYCLE_QUEUE_TYPES.has(queueType)) return;

        if (status === JobStatus.Running) {
            const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
            const currentStatus = trajectory?.status;
            const canTransition =
                currentStatus === TrajectoryStatus.WaitingForProcess ||
                currentStatus === TrajectoryStatus.Queued;

            if (trajectory && canTransition) {
                await Object.assign(trajectory, { status: TrajectoryStatus.Processing }).save();

                await eventBus.emit('trajectory.updated', {
                    trajectoryId,
                    teamId,
                    updates: { status: TrajectoryStatus.Processing },
                    updatedAt: new Date()
                });
            }
        }
    }

    @Event('team.deleted')
    async deleteTeamTrajectories({ teamId, userId }: EventMap['team.deleted']) {
        const trajectories = await Trajectory.find({
            where: { team: teamId },
            select: { id: true }
        });
        const service = this.#service ??= new TrajectoryService();

        await cascadeDeleteEach({
            label: 'TrajectoryEvents',
            ids: trajectories.map((trajectory) => trajectory.id),
            deleteOne: async (trajectoryId) => {
                await service.deleteById({
                    trajectoryId,
                    teamId,
                    userId
                });
            }
        });
    }

    @Event('trajectory.deleted')
    async cleanupJobs(payload: EventMap['trajectory.deleted']) {
        try {
            await teamJobMaintenanceService.cleanupDeletedTrajectory(payload);
        } catch (error) {
            logger.warn(
                error,
                `[TrajectoryEvents] Failed to purge runtime state for trajectory ${payload.trajectoryId}`
            );
        }
    }

    @Event('trajectory.deleted')
    async cleanupStorage({ trajectoryId, storageClusterId }: EventMap['trajectory.deleted']) {
        const targets = getTrajectoryStorageCleanupTargets(trajectoryId);

        if (!storageClusterId) {
            logger.warn(
                `[TrajectoryEvents] Skipping storage cleanup for trajectory ${trajectoryId} because no storage cluster is assigned`
            );
        }

        await Promise.all([
            storageClusterId
                ? this.#cleanupRemoteStorage(storageClusterId, targets)
                : Promise.resolve(),
            StoragePlacement.delete({
                scopeType: StoragePlacementScopeType.Trajectory,
                scopeId: trajectoryId
            }),
            ClusterTransferJob.delete({
                scopeType: StoragePlacementScopeType.Trajectory,
                scopeId: trajectoryId
            })
        ]);
    }

    async #cleanupRemoteStorage(teamClusterId: string, targets: TrajectoryStorageCleanupTarget[]): Promise<void> {
        const results = await Promise.allSettled(
            targets.map((target) => objectGatewayClient.deleteByPrefix(
                teamClusterId,
                target.bucket,
                target.prefix
            ))
        );

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                return;
            }

            const target = targets[index];
            logger.warn(
                result.reason,
                `[TrajectoryEvents] Failed to delete team cluster ${teamClusterId} storage prefix ${target.bucket}/${target.prefix}`
            );
        });
    }
}
