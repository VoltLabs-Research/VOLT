import { eventBus, EventChannels } from './event-bus';

/**
 * Publish a job update event
 */
export const publishJobUpdate = async (teamId: string, payload: any): Promise<void> => {
    await eventBus.emit(EventChannels.JOB_UPDATES, { teamId, payload });
};
