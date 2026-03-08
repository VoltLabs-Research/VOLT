import { registerSubscribers } from '@shared/infrastructure/events/registerSubscribers';

export const registerAISubscribers = (): Promise<void> =>
    registerSubscribers({});
