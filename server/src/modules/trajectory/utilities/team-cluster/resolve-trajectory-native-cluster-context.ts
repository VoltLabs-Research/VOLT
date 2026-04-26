import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';

import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface ResolveTrajectoryNativeClusterContextInput {
    trajectoryId: string;
    trajectoryRepository: ITrajectoryRepository;
    teamClusterSelectionService: TeamClusterSelectionService;
}

interface TrajectoryNativeClusterContext {
    trajectory: Trajectory;
    storageClusterId: string;
    computeClusterId: string;
}

export const resolveTrajectoryNativeClusterContext = async (
    input: ResolveTrajectoryNativeClusterContextInput
): Promise<TrajectoryNativeClusterContext | null> => {
    const trajectory = await input.trajectoryRepository.findById(input.trajectoryId);
    const storageClusterId = trajectory
        ? resolveTrajectoryStorageClusterId(trajectory.props)
        : undefined;

    if (!trajectory || !storageClusterId) {
        return null;
    }

    const computeClusterId = await input.teamClusterSelectionService.resolveComputeClusterId(
        trajectory.props.team,
        undefined,
        storageClusterId
    );

    return {
        trajectory,
        storageClusterId,
        computeClusterId
    };
};
