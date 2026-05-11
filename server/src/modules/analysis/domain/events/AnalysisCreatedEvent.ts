import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import type {
    AnalysisArtifactStatus,
    AnalysisConfig,
    AnalysisExpectedArtifact
} from '@modules/analysis/domain/entities/Analysis';

export interface AnalysisCreatedEventPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    pluginDisplayName: string;
    teamId: string;
    config: AnalysisConfig;
    status: string;
    artifactStatus?: AnalysisArtifactStatus;
    expectedArtifacts?: AnalysisExpectedArtifact[];
    createdAt: Date;
}

export default class AnalysisCreatedEvent extends BaseDomainEvent<AnalysisCreatedEventPayload> {
    constructor(payload: AnalysisCreatedEventPayload) {
        super('analysis.created', payload);
    }
}
