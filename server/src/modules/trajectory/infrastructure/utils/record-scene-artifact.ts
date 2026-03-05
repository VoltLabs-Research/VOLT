import { SYS_BUCKETS } from '@core/config/minio';
import type {
    SceneArtifactParams,
    SceneArtifactSourceType,
    SceneArtifactStatus
} from '@modules/trajectory/domain/entities/SceneArtifact';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/ISceneArtifactRepository';

interface RecordSceneArtifactInput {
    objectName: string;
    trajectory: string;
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    params: SceneArtifactParams;
    displayName: string;
    metadata?: Record<string, any>;
    status?: SceneArtifactStatus;
    storageBucket?: string;
}

export const recordSceneArtifact = async (
    sceneArtifactRepository: ISceneArtifactRepository,
    input: RecordSceneArtifactInput
): Promise<void> => {
    const {
        objectName,
        trajectory,
        analysis,
        plugin,
        sourceType,
        timestep,
        params,
        displayName,
        metadata,
        status = 'ready',
        storageBucket = SYS_BUCKETS.MODELS
    } = input;

    await sceneArtifactRepository.upsertByObjectName(objectName, {
        trajectory,
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
    });
};
