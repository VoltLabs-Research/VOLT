import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface ContainerDeletedEventPayload {
    containerId: string;
    teamId: string;
}

export default class ContainerDeletedEvent extends BaseDomainEvent<ContainerDeletedEventPayload> {
    constructor(payload: ContainerDeletedEventPayload) {
        super('container.deleted', payload);
    }
}
