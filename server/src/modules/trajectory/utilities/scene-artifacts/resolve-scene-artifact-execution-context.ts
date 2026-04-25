import { ErrorCodes } from '@core/constants/error-codes';
import type { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import type AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import type TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import type TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/trajectory/TrajectoryDumpStorageService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { resolveSceneArtifactStorageCluster } from './resolve-scene-artifact-storage-cluster';

interface ResolveSceneArtifactExecutionContextInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    analysisRepository: AnalysisRepository;
    trajectoryRepository: TrajectoryRepository;
    teamClusterSelectionService: TeamClusterSelectionService;
    dumpStorage: TrajectoryDumpStorageService;
    buildClusterRequiredError: () => ApplicationError;
}

export interface SceneArtifactExecutionContext {
    computeClusterId: string;
    storageClusterId: string;
}

export const resolveSceneArtifactExecutionContext = async ({
    trajectoryId,
    timestep,
    analysisId,
    analysisRepository,
    trajectoryRepository,
    teamClusterSelectionService,
    dumpStorage,
    buildClusterRequiredError
}: ResolveSceneArtifactExecutionContextInput): Promise<SceneArtifactExecutionContext> => {
    const storageClusterId = await resolveSceneArtifactStorageCluster({
        trajectoryId,
        analysisId,
        analysisRepository,
        trajectoryRepository
    });

    const trajectory = await trajectoryRepository.findById(trajectoryId);
    if (!trajectory || !storageClusterId) {
        throw buildClusterRequiredError();
    }

    const computeClusterId = await teamClusterSelectionService.resolveComputeClusterId(
        trajectory.props.team,
        undefined,
        storageClusterId
    );

    if (!await dumpStorage.existsDump(trajectoryId, timestep)) {
        throw ApplicationError.notFound(
            ErrorCodes.TRAJECTORY_DUMP_NOT_FOUND,
            `Trajectory dump for timestep ${timestep} not found`
        );
    }

    return { computeClusterId, storageClusterId };
};
