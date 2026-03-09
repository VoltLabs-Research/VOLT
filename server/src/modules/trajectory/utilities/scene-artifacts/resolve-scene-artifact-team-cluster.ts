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
        if (analysis?.props.teamCluster) {
            return analysis.props.teamCluster;
        }
    }

    const trajectory = await input.trajectoryRepository.findById(input.trajectoryId);
    return trajectory?.props.teamCluster;
};
