import { IDomainEvent } from '@/src/shared/application/events/IDomainEvent';
import { v4 } from 'uuid';
import Workflow from '../entities/workflow/Workflow';

export interface PluginDeletedEventPayload {
    pluginId: string;
    teamId: string;
    slug: string;
    workflow: Workflow;
};

export default class PluginDeletedEvent implements IDomainEvent{
    public readonly name = 'plugin.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: PluginDeletedEventPayload
    ){
        this.occurredOn = new Date();
        this.eventId = v4();
    }
};
