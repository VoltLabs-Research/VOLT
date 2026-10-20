
import type {
    SceneArtifactSourceType,
    SceneArtifactStatus
} from '@shared/contracts/types/SceneArtifact';

export interface SceneArtifactBatchUpsertedArtifact {
    objectName: string;
    trajectoryId: string;
    analysisId?: string;
    pluginId?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    displayName: string;
    status: SceneArtifactStatus;
}

export interface SceneArtifactBatchUpsertedEventPayload {
    teamId: string;
    trajectoryId: string;
    analysisId?: string;
    artifacts: SceneArtifactBatchUpsertedArtifact[];
}
