import type { IDomainEvent } from '@shared/application/events/IDomainEvent';

export interface UserCreatedIntegrationEventPayload {
    id: string;
    firstName: string;
}

export interface UserCreatedIntegrationEvent extends IDomainEvent {
    payload: UserCreatedIntegrationEventPayload;
}
