import { resolveTrajectoryStorageClusterId } from '@shared/application/utilities/cluster-location';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';

import TrajectoryModel, { type TrajectoryDocument } from '@modules/trajectory/models/trajectory/TrajectoryModel';

interface ResolveTrajectoryNativeClusterContextInput {
    trajectoryId: string;
    teamClusterSelectionService: ITeamClusterSelectionService;
}

interface TrajectoryNativeClusterContext {
    trajectory: TrajectoryDocument;
    storageClusterId: string;
    computeClusterId: string;
}

export const resolveTrajectoryNativeClusterContext = async (
    input: ResolveTrajectoryNativeClusterContextInput
): Promise<TrajectoryNativeClusterContext | null> => {
    const trajectory = await TrajectoryModel.findById(input.trajectoryId);
    const storageClusterId = trajectory
        ? resolveTrajectoryStorageClusterId({ storageClusterId: trajectory.storageClusterId?.toString() })
        : undefined;

    if (!trajectory || !storageClusterId) {
        return null;
    }

    const computeClusterId = await input.teamClusterSelectionService.resolveComputeClusterId(
        trajectory.team.toString(),
        undefined,
        storageClusterId
    );

    return {
        trajectory,
        storageClusterId,
        computeClusterId
    };
};
