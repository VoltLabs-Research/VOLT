import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface AnalysisDeletedEventPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    teamId: string;
}

export default class AnalysisDeletedEvent extends BaseDomainEvent<AnalysisDeletedEventPayload> {
    constructor(payload: AnalysisDeletedEventPayload) {
        super('analysis.deleted', payload);
    }
}
