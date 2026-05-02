import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface PluginCreatedEventPayload {
    pluginId: string;
    teamId: string;
}

export default class PluginCreatedEvent extends BaseDomainEvent<PluginCreatedEventPayload> {
    constructor(payload: PluginCreatedEventPayload) {
        super('plugin.created', payload);
    }
}
