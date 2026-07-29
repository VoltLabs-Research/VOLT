import type {
    ContainerCreatedEventPayload,
    ContainerDeletedEventPayload,
    ContainerUpdatedEventPayload
} from '@modules/container/contracts/domain/events';

declare global {
    interface EventMap {
        'container.created': ContainerCreatedEventPayload;
        'container.deleted': ContainerDeletedEventPayload;
        'container.updated': ContainerUpdatedEventPayload;
    }
}
