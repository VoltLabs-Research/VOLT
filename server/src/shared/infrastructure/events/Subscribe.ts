import { container, injectable } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import type { InjectionToken } from 'tsyringe';
import type { IDomainEvent } from '@shared/application/events/IDomainEvent';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

type HandlerCtor = new (...args: any[]) => IEventHandler<IDomainEvent>;

interface PendingSubscription {
    eventName: string;
    handler: InjectionToken<IEventHandler<IDomainEvent>>;
};

const pendingSubscriptions: PendingSubscription[] = [];

/**
 * Registers a handler class against one or more event names. The handler is
 * auto-`@injectable()`d and queued for bus subscription at boot time via
 * `flushPendingSubscriptions`. Replaces per-module `subscribers.ts` files.
 */
export const Subscribe = (...eventNames: string[]): ClassDecorator => {
    return (target) => {
        injectable()(target as unknown as HandlerCtor);
        container.registerSingleton(target as unknown as HandlerCtor);

        for (const eventName of eventNames) {
            pendingSubscriptions.push({
                eventName,
                handler: target as unknown as InjectionToken<IEventHandler<IDomainEvent>>
            });
        }
    };
};

/**
 * Escape hatch for dynamically-generated handler classes (e.g., the
 * `deleteManyOn*Handler` factories) that can't carry a class-level decorator.
 */
export const subscribeHandlerClass = (
    eventName: string,
    handler: new () => IEventHandler<IDomainEvent>
): void => {
    pendingSubscriptions.push({
        eventName,
        handler
    });
};

export const flushPendingSubscriptions = async (): Promise<void> => {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);

    logger.info(`@event-bus: subscribing ${pendingSubscriptions.length} handlers`);

    for (const { eventName, handler } of pendingSubscriptions) {
        const resolvedHandler = container.resolve(handler);
        await eventBus.subscribe(eventName, resolvedHandler);
    }

    pendingSubscriptions.length = 0;

    logger.info('@event-bus: subscribers registered');
};
