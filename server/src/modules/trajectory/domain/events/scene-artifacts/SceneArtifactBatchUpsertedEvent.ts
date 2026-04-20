import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import type { SceneArtifactSourceType, SceneArtifactStatus } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';

export interface SceneArtifactBatchUpsertedArtifact {
    objectName: string;
    trajectoryId: string;
    analysisId?: string;
    pluginId?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    displayName: string;
    status: SceneArtifactStatus;
};

export interface SceneArtifactBatchUpsertedEventPayload {
    teamId: string;
    trajectoryId: string;
    analysisId?: string;
    artifacts: SceneArtifactBatchUpsertedArtifact[];
};

export default class SceneArtifactBatchUpsertedEvent extends BaseDomainEvent<SceneArtifactBatchUpsertedEventPayload> {
    constructor(payload: SceneArtifactBatchUpsertedEventPayload) {
        super('scene-artifact.upserted', payload);
    }
};
