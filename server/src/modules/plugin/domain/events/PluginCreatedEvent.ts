import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface PluginCreatedEventPayload {
    pluginId: string;
    teamId: string;
}

export default class PluginCreatedEvent implements IDomainEvent {
    public readonly name = 'plugin.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: PluginCreatedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
