import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import type { AnalysisConfig } from '@modules/analysis/domain/entities/Analysis';

export interface AnalysisCreatedEventPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    pluginDisplayName: string;
    teamId: string;
    config: AnalysisConfig;
    status: string;
    createdAt: Date;
}

export default class AnalysisCreatedEvent extends BaseDomainEvent<AnalysisCreatedEventPayload> {
    constructor(payload: AnalysisCreatedEventPayload) {
        super('analysis.created', payload);
    }
}
