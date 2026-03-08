import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface AnalysisCreatedEventPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    pluginDisplayName?: string;
    teamId: string;
    config: Record<string, unknown>;
    status: string;
    createdAt: Date;
}

export default class AnalysisCreatedEvent extends BaseDomainEvent<AnalysisCreatedEventPayload> {
    constructor(payload: AnalysisCreatedEventPayload) {
        super('analysis.created', payload);
    }
}
