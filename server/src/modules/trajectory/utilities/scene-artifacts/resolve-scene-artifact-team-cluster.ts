import {
    resolveAnalysisStorageClusterId,
    resolveTrajectoryStorageClusterId
} from '@modules/team-cluster/application/utilities/cluster-location';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface ResolveSceneArtifactTeamClusterInput {
    trajectoryId: string;
    analysisId?: string;
    analysisRepository: IAnalysisRepository;
    trajectoryRepository: ITrajectoryRepository;
};

export const resolveSceneArtifactTeamCluster = async (
    input: ResolveSceneArtifactTeamClusterInput
): Promise<string | undefined> => {
    if (input.analysisId) {
        const analysis = await input.analysisRepository.findById(input.analysisId);
        if (analysis) {
            const trajectory = await input.trajectoryRepository.findById(input.trajectoryId);
            return resolveAnalysisStorageClusterId(analysis.props, trajectory?.props);
        }
    }

    const trajectory = await input.trajectoryRepository.findById(input.trajectoryId);
    return trajectory ? resolveTrajectoryStorageClusterId(trajectory.props) : undefined;
};
