import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface AnalysisCreatedEventPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
    pluginSlug: string;
    teamId: string;
    config: Record<string, any>;
    status: string;
    createdAt: Date;
}

export default class AnalysisCreatedEvent implements IDomainEvent {
    public readonly name = 'analysis.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: AnalysisCreatedEventPayload
    ){
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
