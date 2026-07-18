import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import type { TrajectoryDumpStorageService } from '@modules/trajectory/services/trajectory/TrajectoryDumpStorageService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { resolveSceneArtifactStorageCluster } from './resolve-scene-artifact-storage-cluster';

import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';

interface ResolveSceneArtifactExecutionContextInput {
    trajectoryId: string;
    timestep: string;
    analysisId?: string;
    teamClusterSelectionService: ITeamClusterSelectionService;
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
    teamClusterSelectionService,
    dumpStorage,
    buildClusterRequiredError
}: ResolveSceneArtifactExecutionContextInput): Promise<SceneArtifactExecutionContext> => {
    const storageClusterId = await resolveSceneArtifactStorageCluster({
        trajectoryId,
        analysisId
    });

    const trajectory = await TrajectoryModel.findById(trajectoryId);
    if (!trajectory || !storageClusterId) {
        throw buildClusterRequiredError();
    }

    const computeClusterId = await teamClusterSelectionService.resolveComputeClusterId(
        trajectory.team.toString(),
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
