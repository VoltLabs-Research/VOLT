import eventBus from '@shared/infrastructure/events/RedisEventBus';
import logger from '@shared/infrastructure/logger';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

interface PendingSubscription {
    eventName: string;
    handler: IEventHandler<IDomainEvent>;
}

const pendingSubscriptions: PendingSubscription[] = [];

export const subscribeHandler = (eventName: string, handler: IEventHandler<IDomainEvent>): void => {
    pendingSubscriptions.push({ eventName, handler });
};

export const flushPendingSubscriptions = async (): Promise<void> => {
    logger.info(`@event-bus: subscribing ${pendingSubscriptions.length} handlers`);

    for (const { eventName, handler } of pendingSubscriptions) {
        await eventBus.subscribe(eventName, handler);
    }

    pendingSubscriptions.length = 0;

    logger.info('@event-bus: subscribers registered');
};
