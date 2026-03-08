import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface ContainerCreatedEventPayload {
    containerId: string;
    teamId: string;
    name: string;
};

export default class ContainerCreatedEvent extends BaseDomainEvent<ContainerCreatedEventPayload> {
    constructor(payload: ContainerCreatedEventPayload) {
        super('container.created', payload);
    }
};
