import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface ContainerDeletedEventPayload {
    containerId: string;
    teamId: string;
}

export default class ContainerDeletedEvent implements IDomainEvent {
    public readonly name = 'container.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: ContainerDeletedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
