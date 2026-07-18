import {
    resolveAnalysisStorageClusterId,
    resolveTrajectoryStorageClusterId
} from '@shared/application/utilities/cluster-location';
import type { IAnalysisRepository } from '@shared/contracts/ports';

import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';

interface ResolveSceneArtifactStorageClusterInput {
    trajectoryId: string;
    analysisId?: string;
    analysisRepository: IAnalysisRepository;
}

export const resolveSceneArtifactStorageCluster = async (
    input: ResolveSceneArtifactStorageClusterInput
): Promise<string | undefined> => {
    if (input.analysisId) {
        const analysis = await input.analysisRepository.findById(input.analysisId);
        if (analysis) {
            return resolveAnalysisStorageClusterId(analysis.props);
        }
    }

    const trajectory = await TrajectoryModel.findById(input.trajectoryId);
    return trajectory ? resolveTrajectoryStorageClusterId({ storageClusterId: trajectory.storageClusterId?.toString() }) : undefined;
};
