import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface ContainerCreatedEventPayload {
    containerId: string;
    teamId: string;
    name: string;
}

export default class ContainerCreatedEvent implements IDomainEvent {
    public readonly name = 'container.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: ContainerCreatedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
