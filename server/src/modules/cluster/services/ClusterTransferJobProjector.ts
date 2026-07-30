import eventBus from '@shared/infrastructure/events/RedisEventBus';
import Analysis from '@modules/analysis/models/Analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';
import { type ClusterTransferJob } from '@modules/cluster/contracts/cluster-transfer-job';
import { JobStatus } from '@shared/contracts/types';
import type {
    ClusterTransferJobState
} from '@volt/contracts/modules/cluster/domain';
import type {
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import {
    CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_ID,
    CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_NAME,
    CLUSTER_TRANSFER_QUEUE_TYPE
} from '@modules/cluster/services/cluster-transfer-constants';

const mapTransferStateToJobStatus = (state: ClusterTransferJobState): JobStatus => {
    switch (state) {
        case 'completed':
            return JobStatus.Completed;
        case 'failed':
            return JobStatus.Failed;
        case 'queued':
            return JobStatus.Queued;
        default:
            return JobStatus.Running;
    }
};

const getTransferJobName = (scopeType: StoragePlacementScopeType): string => {
    switch (scopeType) {
        case 'trajectory':
            return 'Trajectory Transfer';
        case 'analysis':
            return 'Analysis Transfer';
        default:
            return 'Storage Transfer';
    }
};

const getTransferJobMessage = (job: ClusterTransferJob): string => {
    switch (job.props.state) {
        case 'queued':
            return 'Waiting for transfer worker';
        case 'freezing':
            return 'Freezing source placement';
        case 'copying':
            return 'Copying authoritative storage objects';
        case 'verifying':
            return 'Verifying copied storage objects';
        case 'switching':
            return 'Switching authoritative storage owner';
        case 'cleaning':
            return 'Cleaning source cluster copy';
        case 'completed':
            return 'Transfer completed';
        case 'failed':
            return job.props.errorMessage || 'Transfer failed';
        default:
            return 'Transfer update';
    }
};

interface TransferJobProjectionContext {
    trajectoryId: string;
    trajectoryName: string;
    analysisId?: string;
}


/**
 * Projects cluster transfer job state onto the team job feed so the UI can
 * follow a transfer without polling the transfer tables directly.
 */
export default class ClusterTransferJobProjector{
    #eventBus = eventBus;

    async publishTransferJobProjection(job: ClusterTransferJob): Promise<void> {
        try {
            const projectionContext = await this.#resolveTransferJobProjectionContext(job);
            const status = mapTransferStateToJobStatus(job.props.state);

            await this.#eventBus.emit('job.status.changed', {
                jobId: job.id,
                teamId: job.props.team,
                status,
                queueType: CLUSTER_TRANSFER_QUEUE_TYPE,
                name: getTransferJobName(job.props.scopeType),
                message: getTransferJobMessage(job),
                trajectoryId: projectionContext.trajectoryId,
                trajectoryName: projectionContext.trajectoryName,
                analysisId: projectionContext.analysisId,
                source: 'projected',
                backingSource: 'local',
                cleanupScope: 'cluster-transfer',
                transferJobId: job.id,
                transferState: job.props.state,
                transferReason: job.props.reason,
                transferScopeType: job.props.scopeType,
                transferScopeId: job.props.scopeId,
                sourceClusterId: job.props.sourceClusterId,
                destinationClusterId: job.props.destinationClusterId,
                cleanupSource: job.props.cleanupSource,
                copiedObjects: job.props.stats.copiedObjects,
                copiedBytes: job.props.stats.copiedBytes,
                verifiedObjects: job.props.stats.verifiedObjects,
                verifiedBytes: job.props.stats.verifiedBytes,
                deletedObjects: job.props.stats.deletedObjects,
                ...(job.props.errorMessage ? { error: job.props.errorMessage } : {})
            });
        } catch {
            logger.warn(`Failed to project cluster transfer job into team jobs history transferJobId=${job.id} scopeType=${job.props.scopeType} scopeId=${job.props.scopeId}`);
        }
    }

    async #resolveTransferJobProjectionContext(
        job: ClusterTransferJob
    ): Promise<TransferJobProjectionContext> {
        if (job.props.scopeType === 'trajectory') {
            const trajectory = await Trajectory.findOne({
                where: { id: job.props.scopeId },
                select: {
                    id: true,
                    name: true
                }
            });

            return {
                trajectoryId: job.props.scopeId,
                trajectoryName: trajectory?.name || `Trajectory ${job.props.scopeId}`
            };
        }

        if (job.props.scopeType === 'analysis') {
            const analysis = await Analysis.findOne({
                where: { id: job.props.scopeId },
                select: {
                    id: true,
                    trajectory: true
                }
            });
            const trajectoryId = analysis?.trajectory;

            if (trajectoryId) {
                const trajectory = await Trajectory.findOne({
                    where: { id: trajectoryId },
                    select: {
                        id: true,
                        name: true
                    }
                });

                return {
                    trajectoryId,
                    trajectoryName: trajectory?.name || `Trajectory ${trajectoryId}`,
                    analysisId: job.props.scopeId
                };
            }
        }

        return {
            trajectoryId: CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_ID,
            trajectoryName: CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_NAME,
            ...(job.props.scopeType === 'analysis' ? { analysisId: job.props.scopeId } : {})
        };
    }
}
