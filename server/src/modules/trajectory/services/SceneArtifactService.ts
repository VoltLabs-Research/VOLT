import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisModel from '@modules/analysis/models/AnalysisModel';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import type { TrajectoryDumpStorageService } from '@modules/trajectory/services/trajectory/TrajectoryDumpStorageService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import {
    resolveAnalysisStorageClusterId,
    resolveTrajectoryStorageClusterId
} from '@shared/application/utilities/cluster-location';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import type {
    SceneArtifactParams,
    SceneArtifactSourceType,
    SceneArtifactStatus
} from '@shared/contracts/types/SceneArtifact';

interface RecordSceneArtifactInput {
    objectName: string;
    trajectory: string;
    storageClusterId: string;
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    params: SceneArtifactParams;
    displayName: string;
    metadata?: Record<string, unknown>;
    status?: SceneArtifactStatus;
    storageBucket?: string;
}

interface ResolveSceneArtifactStorageClusterInput {
    trajectoryId: string;
    analysisId?: string;
}

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

export const recordSceneArtifact = async (input: RecordSceneArtifactInput): Promise<void> => {
    const {
        objectName,
        trajectory,
        storageClusterId,
        analysis,
        plugin,
        sourceType,
        timestep,
        params,
        displayName,
        metadata,
        status = 'ready' as SceneArtifactStatus,
        storageBucket = TEAM_CLUSTER_BUCKETS.MODELS
    } = input;

    await SceneArtifactModel.findOneAndUpdate(
        { objectName },
        {
            $set: {
                trajectory,
                storageClusterId,
                analysis,
                plugin,
                sourceType,
                timestep,
                objectName,
                storageBucket,
                params,
                displayName,
                status,
                metadata
            }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    ).exec();
};

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
    return trajectory
        ? resolveTrajectoryStorageClusterId({ storageClusterId: trajectory.storageClusterId?.toString() })
        : undefined;
};

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
