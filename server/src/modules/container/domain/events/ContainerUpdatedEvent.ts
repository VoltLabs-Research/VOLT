import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface ContainerUpdatedEventPayload {
    containerId: string;
    teamId: string;
    containerName: string;
};

export default class ContainerUpdatedEvent extends BaseDomainEvent<ContainerUpdatedEventPayload> {
    constructor(payload: ContainerUpdatedEventPayload) {
        super('container.updated', payload);
    }
};
