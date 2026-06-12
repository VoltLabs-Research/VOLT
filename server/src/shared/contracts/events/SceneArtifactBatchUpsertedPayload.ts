/**
 * Neutral, standalone copy of the `scene-artifact.upserted` domain-event payload.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration). Mirrors
 * `SceneArtifactBatchUpsertedEventPayload` owned by
 * `@modules/trajectory/domain/events/scene-artifacts/SceneArtifactBatchUpsertedEvent`,
 * exported here so cross-module consumers can type the event payload without
 * importing the trajectory module. The `SceneArtifactSourceType` /
 * `SceneArtifactStatus` enums come from the neutral
 * `@shared/contracts/types/SceneArtifact` copy.
 *
 * No `@modules/*` imports — pure type declarations only.
 */
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
