import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import Analysis from '@modules/analysis/models/Analysis';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import Trajectory from '@modules/trajectory/models/Trajectory';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import trajectoryDumpStorageService from '@modules/trajectory/services/trajectory/TrajectoryDumpStorageService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { generateEntityId } from '@shared/infrastructure/persistence/entity-id';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import type {
    SceneArtifactParams,
    SceneArtifactSourceType,
    SceneArtifactStatus
} from '@shared/contracts/types/SceneArtifact';
import type { SceneArtifactMetadata } from '@modules/trajectory/contracts/scene-artifact';

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
}

interface SceneArtifactExecutionContext {
    computeClusterId: string;
    storageClusterId: string;
}

/**
 * Raised whenever an operation needs a team cluster to run on and none could be
 * resolved. Shared by every scene-artifact producer (color coding, particle
 * filter, line style) so the three of them report the same failure.
 */
export const buildClusterRequiredError = (): ApplicationError => {
    return new ApplicationError(
        ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
        'This operation requires a team cluster. No local native modules available.',
        501
    );
};

const RECORDED_COLUMNS = [
    'trajectory',
    'storageClusterId',
    'analysis',
    'plugin',
    'sourceType',
    'timestep',
    'storageBucket',
    'params',
    'displayName',
    'status',
    'metadata',
    'updatedAt'
];

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

    await SceneArtifact.createQueryBuilder()
        .insert()
        .values({
            id: generateEntityId(),
            objectName,
            trajectory,
            storageClusterId,
            analysis: analysis ?? null,
            plugin: plugin ?? null,
            sourceType,
            timestep,
            storageBucket,
            params: params as QueryDeepPartialEntity<SceneArtifactParams>,
            displayName,
            status,
            metadata: (metadata ?? {}) as QueryDeepPartialEntity<SceneArtifactMetadata>,
            updatedAt: new Date()
        })
        .orUpdate(RECORDED_COLUMNS, ['objectName'])
        .execute();
};

export const resolveSceneArtifactStorageCluster = async (
    input: ResolveSceneArtifactStorageClusterInput
): Promise<string | undefined> => {
    if (input.analysisId) {
        const analysis = await Analysis.findOneBy({ id: input.analysisId });
        if (analysis) {
            return analysis.storageClusterId ?? undefined;
        }
    }

    const trajectory = await Trajectory.findOneBy({ id: input.trajectoryId });
    return trajectory
        ? trajectory.storageClusterId
        : undefined;
};

export const resolveSceneArtifactExecutionContext = async ({
    trajectoryId,
    timestep,
    analysisId
}: ResolveSceneArtifactExecutionContextInput): Promise<SceneArtifactExecutionContext> => {
    const storageClusterId = await resolveSceneArtifactStorageCluster({
        trajectoryId,
        analysisId
    });

    const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
    if (!trajectory || !storageClusterId) {
        throw buildClusterRequiredError();
    }

    const computeClusterId = await teamClusterSelectionService.resolveComputeClusterId(
        trajectory.team,
        undefined,
        storageClusterId
    );

    if (!await trajectoryDumpStorageService.existsDump(trajectoryId, timestep)) {
        throw ApplicationError.notFound(
            ErrorCodes.TRAJECTORY_DUMP_NOT_FOUND,
            `Trajectory dump for timestep ${timestep} not found`
        );
    }

    return {
        computeClusterId,
        storageClusterId
    };
};
