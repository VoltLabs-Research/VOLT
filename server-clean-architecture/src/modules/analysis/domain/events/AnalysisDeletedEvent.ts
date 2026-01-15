import { IDomainEvent } from '@/src/shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface AnalysisDeletedEventPayload {
    analysisId: string;
    trajectoryId: string;
    pluginId: string;
};

export default class AnalysisDeletedEvent implements IDomainEvent {
    public readonly name = 'analysis.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: AnalysisDeletedEventPayload
    ){
        this.occurredOn = new Date();
        this.eventId = v4();
    }
};
