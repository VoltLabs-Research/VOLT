import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface PluginPublishedEventPayload {
    pluginId: string;
    teamId: string;
    binaryObjectPath?: string;
    requirementsFile?: string;
    entrypointScript?: string;
    binaryHash?: string;
};

export default class PluginPublishedEvent extends BaseDomainEvent<PluginPublishedEventPayload> {
    constructor(payload: PluginPublishedEventPayload) {
        super('plugin.published', payload);
    }
};
