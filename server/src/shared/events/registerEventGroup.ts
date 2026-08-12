import { subscribeHandler } from '@shared/infrastructure/events/event-registry';
import { getEventGroup, getEvents } from '@shared/events/EventGroup';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';

type PayloadHandler = (payload: unknown) => unknown;

export const registerEventGroup = (GroupClass: new () => object): void => {
    const group = getEventGroup(GroupClass);

    if (!group) {
        throw new Error(`${GroupClass.name} is missing @DefineEventGroup.`);
    }

    const bindings = getEvents(GroupClass);

    if (bindings.length === 0) {
        throw new Error(`Event group ${GroupClass.name} declares no @Event handlers.`);
    }

    const instance = new GroupClass() as Record<string | symbol, PayloadHandler>;

    for (const { event, handlerName } of bindings) {
        const handler = instance[handlerName];

        if (!handler) {
            throw new Error(`Event group ${GroupClass.name} has no handler method for "${event}".`);
        }

        subscribeHandler(event, {
            label: `${GroupClass.name}.${String(handlerName)}`,
            handle: async (domainEvent: IDomainEvent): Promise<void> => {
                await handler.call(instance, domainEvent.payload);
            }
        });
    }
};
