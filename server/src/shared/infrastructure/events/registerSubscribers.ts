import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { IDomainEvent } from '@shared/application/events/IDomainEvent';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { container } from 'tsyringe';
import type { InjectionToken } from 'tsyringe';

type HandlerToken = InjectionToken<IEventHandler<IDomainEvent>>;

export type SubscriberManifest = Record<string, HandlerToken | HandlerToken[]>;

export async function registerSubscribers(
    subscriptions: SubscriberManifest
): Promise<void> {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);
    for (const [event, configuredHandlers] of Object.entries(subscriptions)) {
        const handlerTokens = Array.isArray(configuredHandlers)
            ? configuredHandlers
            : [configuredHandlers];

        for (const handlerToken of handlerTokens) {
            const handler = container.resolve(handlerToken);
            await eventBus.subscribe(event, handler);
        }
    }
}
