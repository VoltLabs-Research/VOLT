import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';

export const registerJobsSubscribers = (): Promise<void> =>
    registerSubscribers({});
