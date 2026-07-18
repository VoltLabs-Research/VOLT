import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';

import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import type { SceneArtifactParams, SceneArtifactSourceType, SceneArtifactStatus } from '@shared/contracts/types/SceneArtifact';

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
