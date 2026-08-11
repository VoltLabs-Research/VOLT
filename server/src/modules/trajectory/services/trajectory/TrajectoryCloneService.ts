import { ErrorCodes } from '@core/constants/error-codes';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryCloneJob from '@modules/trajectory/models/TrajectoryCloneJob';
import TeamCluster from '@modules/cluster/models/TeamCluster';
import { createTrajectoryCloneJobStats } from '@modules/trajectory/contracts/trajectory-clone-job';

import storagePlacementService from '@modules/cluster/services/storage/StoragePlacementService';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import trajectoryCloneCoordinator from '@modules/trajectory/services/TrajectoryCloneCoordinator';
import trajectoryCloneRunner from '@modules/trajectory/services/trajectory/TrajectoryCloneRunner';
import TrajectoryAccessGuard from '@modules/trajectory/services/trajectory/TrajectoryAccessGuard';
import { getTrajectoryFrames } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import { replaceTrajectoryFrames } from '@modules/trajectory/services/trajectory/TrajectoryFrameStore';

import ApplicationError from '@shared/application/errors/ApplicationError';
import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import { resolveEffectiveCapabilitiesFromRoleConfig } from '@shared/domain/utilities/cluster-capabilities';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';

import type {
    CloneTrajectoryInput,
    CloneTrajectoryOutput
} from '@modules/trajectory/services/TrajectoryServiceTypes';

const accessGuard = new TrajectoryAccessGuard();

/**
 * A caller may nominate a destination cluster, but it still has to be connected
 * and accept storage writes; otherwise the team's default placement wins.
 */
const resolveDestinationStorageClusterId = async (teamId: string, requestedClusterId?: string): Promise<string> => {
    if (!requestedClusterId) {
        return teamClusterSelectionService.resolveStorageClusterId(teamId);
    }

    const requestedCluster = await TeamCluster.findOneBy({ id: requestedClusterId });
    if (!requestedCluster || requestedCluster.team !== teamId) {
        throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 'Team cluster not found for the requested team');
    }

    if (requestedCluster.status !== TeamClusterStatus.Connected) {
        throw ApplicationError.conflict(
            ErrorCodes.TEAM_CLUSTER_STORAGE_CLUSTER_REQUIRED,
            'A connected storage-capable team cluster is required for this operation'
        );
    }

    if (resolveEffectiveCapabilitiesFromRoleConfig(requestedCluster.roleConfig).acceptsStorageWrites) {
        return requestedCluster.id;
    }

    return teamClusterSelectionService.resolveStorageClusterId(teamId, undefined, requestedCluster.id);
};

/**
 * Creates the destination trajectory synchronously so the client gets an id back
 * immediately, then queues a job that copies the dump objects cluster-to-cluster.
 */
export const cloneTrajectory = async (input: CloneTrajectoryInput): Promise<CloneTrajectoryOutput> => {
    const source = await accessGuard.assertReadable(input.sourceTrajectoryId, input.userId);
    const destinationClusterId = await resolveDestinationStorageClusterId(input.teamId, input.targetClusterId);
    const sourceFrames = await getTrajectoryFrames(source.id);
    const now = new Date();

    const destinationTrajectory = await Trajectory.create({
        name: source.name,
        team: input.teamId,
        folder: null,
        storageClusterId: destinationClusterId,
        createdBy: input.userId,
        status: TrajectoryStatus.Processing,
        stats: { ...source.stats },
        hasPreview: false,
        isPublic: true,
        updatedAt: now,
        createdAt: now
    }).save();

    if (sourceFrames.length > 0) {
        await replaceTrajectoryFrames(destinationTrajectory.id, sourceFrames);
    }

    await storagePlacementService.ensurePlacement('trajectory', destinationTrajectory.id);

    const job = await TrajectoryCloneJob.create({
        team: input.teamId,
        sourceTrajectoryId: source.id,
        destinationTrajectoryId: destinationTrajectory.id,
        sourceClusterId: source.storageClusterId,
        destinationClusterId,
        requestedBy: input.userId,
        stats: createTrajectoryCloneJobStats({ totalFrames: sourceFrames.length })
    }).save();

    await trajectoryCloneCoordinator.publishJobProjection(job);
    trajectoryCloneRunner.kick(1);

    await eventBus.emit('trajectory.created', {
        trajectoryId: destinationTrajectory.id,
        trajectoryName: destinationTrajectory.name,
        teamId: input.teamId,
        userId: input.userId
    });

    return {
        trajectoryId: destinationTrajectory.id,
        jobId: job.id,
        sourceTrajectoryId: source.id,
        destinationClusterId
    };
};
