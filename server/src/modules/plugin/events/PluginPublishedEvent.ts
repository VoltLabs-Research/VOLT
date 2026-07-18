import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';

export interface PluginPublishedEventPayload {
    pluginId: string;
    teamId: string;
    binaryObjectPath?: string;
    requirementsFile?: string;
    entrypointScript?: string;
    binaryHash?: string;
}

export default class PluginPublishedEvent extends BaseDomainEvent<PluginPublishedEventPayload> {
    constructor(payload: PluginPublishedEventPayload) {
        super('plugin.published', payload);
    }
}
