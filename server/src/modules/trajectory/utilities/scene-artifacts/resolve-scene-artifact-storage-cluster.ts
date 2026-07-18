import {
    resolveAnalysisStorageClusterId,
    resolveTrajectoryStorageClusterId
} from '@shared/application/utilities/cluster-location';

import AnalysisModel from '@modules/analysis/models/AnalysisModel';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';

interface ResolveSceneArtifactStorageClusterInput {
    trajectoryId: string;
    analysisId?: string;
}

export const resolveSceneArtifactStorageCluster = async (
    input: ResolveSceneArtifactStorageClusterInput
): Promise<string | undefined> => {
    if (input.analysisId) {
        const analysis = await AnalysisModel.findById(input.analysisId);
        if (analysis) {
            return resolveAnalysisStorageClusterId({ storageClusterId: analysis.storageClusterId?.toString() });
        }
    }

    const trajectory = await TrajectoryModel.findById(input.trajectoryId);
    return trajectory ? resolveTrajectoryStorageClusterId({ storageClusterId: trajectory.storageClusterId?.toString() }) : undefined;
};
