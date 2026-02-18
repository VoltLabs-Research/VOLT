import { container } from 'tsyringe';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';

type HandlerClass = new (...args: any[]) => any;

export async function registerSubscribers(
    subscriptions: Record<string, HandlerClass>
): Promise<void> {
    const eventBus = container.resolve<IEventBus>(SHARED_TOKENS.EventBus);
    for (const [event, HandlerClass] of Object.entries(subscriptions)) {
        const handler = container.resolve(HandlerClass);
        await eventBus.subscribe(event, handler);
    }
}
