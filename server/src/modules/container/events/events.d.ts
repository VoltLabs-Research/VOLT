import type { ContainerCreatedEventPayload } from '@modules/container/events/ContainerCreatedEvent';
import type { ContainerDeletedEventPayload } from '@modules/container/events/ContainerDeletedEvent';
import type { ContainerUpdatedEventPayload } from '@modules/container/events/ContainerUpdatedEvent';

declare global {
    interface EventMap {
        'container.created': ContainerCreatedEventPayload;
        'container.deleted': ContainerDeletedEventPayload;
        'container.updated': ContainerUpdatedEventPayload;
    }
}
