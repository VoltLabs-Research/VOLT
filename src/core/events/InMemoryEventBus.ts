import type { IDomainEvent } from '@/core/events/IDomainEvent';
import type { IEventBus } from '@/core/events/IEventBus';
import type { IEventHandler } from '@/core/events/IEventHandler';

export class InMemoryEventBus implements IEventBus {
    private readonly handlers = new Map<string, Set<IEventHandler>>();

    async publish(event: IDomainEvent): Promise<void> {
        const handlers = this.getHandlers(event.name);
        if (handlers.size === 0) {
            return;
        }

        const pendingHandlers: Array<Promise<void>> = [];
        for (const handler of handlers) {
            pendingHandlers.push(Promise.resolve(handler.handle(event)));
        }

        await Promise.all(pendingHandlers);
    }

    subscribe(eventName: string, handler: IEventHandler): Promise<void> {
        const handlers = this.getHandlers(eventName);
        handlers.add(handler);
        this.handlers.set(eventName, handlers);

        return Promise.resolve();
    }

    private getHandlers(eventName: string): Set<IEventHandler> {
        return this.handlers.get(eventName) ?? new Set<IEventHandler>();
    }
}
