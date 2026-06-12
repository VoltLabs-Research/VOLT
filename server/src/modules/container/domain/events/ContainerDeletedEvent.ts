import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';

export interface ContainerDeletedEventPayload {
    containerId: string;
    teamId: string;
    userId: string;
    containerName: string;
}

export default class ContainerDeletedEvent extends BaseDomainEvent<ContainerDeletedEventPayload> {
    constructor(payload: ContainerDeletedEventPayload) {
        super('container.deleted', payload);
    }
}
