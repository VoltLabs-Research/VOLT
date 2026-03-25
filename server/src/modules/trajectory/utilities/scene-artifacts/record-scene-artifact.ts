import { SYS_BUCKETS } from '@core/config/minio';

import type { SceneArtifactParams, SceneArtifactSourceType, SceneArtifactStatus } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';

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
};

export const recordSceneArtifact = async (
    sceneArtifactRepository: ISceneArtifactRepository,
    input: RecordSceneArtifactInput
): Promise<void> => {
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
        storageBucket = SYS_BUCKETS.MODELS
    } = input;

    await sceneArtifactRepository.upsertByObjectName(objectName, {
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
    });
};
