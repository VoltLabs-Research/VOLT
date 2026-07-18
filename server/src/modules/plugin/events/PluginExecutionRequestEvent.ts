import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';

export interface PluginExecutionRequestPayload {
    pluginId: string;
    trajectoryId: string;
    userId: string;
    pluginName: string;
    teamId: string;
    trajectoryName: string;
}

export default class PluginExecutionRequestEvent extends BaseDomainEvent<PluginExecutionRequestPayload> {
    constructor(payload: PluginExecutionRequestPayload) {
        super('PluginExecutionRequest', payload);
    }
}
