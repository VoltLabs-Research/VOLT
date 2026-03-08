import { container, type InjectionToken } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';

type HandlerToken = InjectionToken<any>;

export async function registerSubscribers(
    subscriptions: Record<string, HandlerToken>
): Promise<void> {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);
    for (const [event, handlerToken] of Object.entries(subscriptions)) {
        const handler = container.resolve(handlerToken);
        await eventBus.subscribe(event, handler);
    }
}
