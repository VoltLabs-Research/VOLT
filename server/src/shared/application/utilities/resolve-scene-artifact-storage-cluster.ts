/**
 * Neutral STANDALONE copy of the scene-artifact storage-cluster resolver, owned
 * by `@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-storage-cluster`.
 *
 * Although this is an async, repository-driven resolver, it is neutralizable
 * without any `@modules/*` coupling: it accepts the analysis/trajectory
 * repositories as parameters (typed against the neutral
 * `@shared/contracts/ports` interfaces) and internally uses only the neutral
 * `@shared/application/utilities/cluster-location` helpers. Callers inject the
 * (already-neutral) repository instances. The trajectory module source is
 * off-limits to this migration, so cross-module consumers (raster) depend on
 * this neutral copy. Behavior matches the owner exactly.
 *
 * No `@modules/*` imports.
 */
import {
    resolveAnalysisStorageClusterId,
    resolveTrajectoryStorageClusterId
} from '@shared/application/utilities/cluster-location';
import type { IAnalysisRepository, ITrajectoryRepository } from '@shared/contracts/ports';

interface ResolveSceneArtifactStorageClusterInput {
    trajectoryId: string;
    analysisId?: string;
    analysisRepository: IAnalysisRepository;
    trajectoryRepository: ITrajectoryRepository;
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

    const trajectory = await input.trajectoryRepository.findById(input.trajectoryId);
    return trajectory ? resolveTrajectoryStorageClusterId(trajectory.props) : undefined;
};
