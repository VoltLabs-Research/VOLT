import { IDomainEvent } from '@shared/application/events/IDomainEvent';

/**
 * Publishes the plugin execution event.
 * This triggers the following side effects via event subscribers:
 * - Updates the associated {@link Trajectory} status to Queued.
 * - Logs the operation in the daily activity for the associated {@link userId}.
 */
export default class PluginExecutionRequestEvent implements IDomainEvent{
    readonly name = 'PluginExecutionRequest';
    readonly eventId: string;
    readonly occurredOn: Date;

    constructor(
        public readonly pluginId: string,
        public readonly trajectoryId: string,
        public readonly userId: string,
        public readonly pluginName: string,
        public readonly teamId: string,
        public readonly trajectoryName: string
    ){
        this.occurredOn = new Date();
        this.eventId = crypto.randomUUID();
    }
};