import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';

export type EventHandler = (event: IDomainEvent) => Promise<void> | void;

export class EventDispatcher {
    private readonly handlers = new Map<string, Set<EventHandler>>();

    async publish(event: IDomainEvent): Promise<void> {
        const handlers = this.handlers.get(event.name);
        if (!handlers || handlers.size === 0) return;

        await Promise.all([...handlers].map((handler) => Promise.resolve(handler(event))));
    }

    subscribe(eventName: string, handler: EventHandler): void {
        let handlers = this.handlers.get(eventName);
        if (!handlers) {
            handlers = new Set<EventHandler>();
            this.handlers.set(eventName, handlers);
        }
        handlers.add(handler);
    }
}

let eventDispatcherInstance: EventDispatcher | null = null;

export const getEventDispatcher = (): EventDispatcher => {
    eventDispatcherInstance ??= new EventDispatcher();
    return eventDispatcherInstance;
};
