import Workflow from '@modules/plugin/workflow/Workflow';

import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';

export interface PluginDeletedEventPayload {
    pluginId: string;
    teamId: string;
    workflow: Workflow;
}

export default class PluginDeletedEvent extends BaseDomainEvent<PluginDeletedEventPayload> {
    constructor(payload: PluginDeletedEventPayload) {
        super('plugin.deleted', payload);
    }
}
