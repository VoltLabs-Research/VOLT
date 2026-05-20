import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface AnalysisDeletedEventPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    teamId: string;
    teamClusterId?: string;
    storageClusterId?: string;
    computeClusterId?: string;
    userId: string;
    pluginDisplayName: string;
}

export default class AnalysisDeletedEvent extends BaseDomainEvent<AnalysisDeletedEventPayload> {
    constructor(payload: AnalysisDeletedEventPayload) {
        super('analysis.deleted', payload);
    }
}
