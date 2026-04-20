import type { IDomainEvent } from '@/core/events/IDomainEvent';
import { Service } from '@/core/decorators/service';

export type EventHandler = (event: IDomainEvent) => Promise<void> | void;

@Service('eventDispatcher')
export class EventDispatcher {
    private readonly handlers = new Map<string, Set<EventHandler>>();

    async publish(event: IDomainEvent): Promise<void> {
        const handlers = this.handlers.get(event.name);
        if (!handlers || handlers.size === 0) {
            return;
        }

        await Promise.all([...handlers].map((handler) => Promise.resolve(handler(event))));
    }

    subscribe(eventName: string, handler: EventHandler): void {
        const handlers = this.handlers.get(eventName) ?? new Set<EventHandler>();
        handlers.add(handler);
        this.handlers.set(eventName, handlers);
    }
}
