import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import Analysis from '@modules/analysis/models/Analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';
import { type ClusterTransferJob } from '@modules/cluster/contracts/cluster-transfer-job';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
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
} from '@modules/cluster/services/transfer/cluster-transfer-constants';

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

const resolveTrajectoryName = async (trajectoryId: string): Promise<string> => {
    const trajectory = await Trajectory.findOne({
        where: { id: trajectoryId },
        select: {
            id: true,
            name: true
        }
    });

    return trajectory?.name || `Trajectory ${trajectoryId}`;
};

const resolveProjectionContext = async (
    scopeType: StoragePlacementScopeType,
    scopeId: string
): Promise<TransferJobProjectionContext> => {
    if (scopeType === 'trajectory') {
        return {
            trajectoryId: scopeId,
            trajectoryName: await resolveTrajectoryName(scopeId)
        };
    }

    if (scopeType !== 'analysis') {
        return {
            trajectoryId: CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_ID,
            trajectoryName: CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_NAME
        };
    }

    const analysis = await Analysis.findOne({
        where: { id: scopeId },
        select: {
            id: true,
            trajectory: true
        }
    });
    const trajectoryId = analysis?.trajectory;

    return {
        trajectoryId: trajectoryId ?? CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_ID,
        trajectoryName: trajectoryId
            ? await resolveTrajectoryName(trajectoryId)
            : CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_NAME,
        analysisId: scopeId
    };
};

const publishTransferJobProjection = async (job: ClusterTransferJob): Promise<void> => {
    try {
        const context = await resolveProjectionContext(job.props.scopeType, job.props.scopeId);

        await eventBus.emit('job.status.changed', {
            jobId: job.id,
            teamId: job.props.team,
            status: mapTransferStateToJobStatus(job.props.state),
            queueType: CLUSTER_TRANSFER_QUEUE_TYPE,
            name: getTransferJobName(job.props.scopeType),
            message: getTransferJobMessage(job),
            trajectoryId: context.trajectoryId,
            trajectoryName: context.trajectoryName,
            analysisId: context.analysisId,
            source: 'projected',
            backingSource: 'local',
            cleanupScope: 'cluster-transfer',
            ...(job.props.errorMessage ? { error: job.props.errorMessage } : {})
        });
    } catch {
        logger.warn(`Failed to project cluster transfer job into team jobs history transferJobId=${job.id} scopeType=${job.props.scopeType} scopeId=${job.props.scopeId}`);
    }
};

export default publishTransferJobProjection;
