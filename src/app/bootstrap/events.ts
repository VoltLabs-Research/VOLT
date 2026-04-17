import { asClass, type AwilixContainer } from 'awilix';
import type { IDomainEvent } from '@/core/events/IDomainEvent';
import type { IEventBus } from '@/core/events/IEventBus';
import type { IEventHandler } from '@/core/events/IEventHandler';
import { logger } from '@/core/logger';
import { discoverModuleExports } from '@/app/bootstrap/module-discovery';
import { resolveScopedRegistration } from '@/app/bootstrap/scoped-resolution';

interface EventSubscriberEvent {
    readonly name: string;
}

interface EventSubscriberPrototype<TEvent extends EventSubscriberEvent = EventSubscriberEvent> {
    handle(event: TEvent): Promise<void> | void;
}

interface EventSubscriberClass<TEvent extends EventSubscriberEvent = EventSubscriberEvent> {
    readonly subscribedTo: string;
    readonly prototype: EventSubscriberPrototype<TEvent>;
    new (event: TEvent, ...args: readonly unknown[]): EventSubscriberPrototype<TEvent>;
}

interface DiscoveredEventSubscriber {
    registrationName: string;
    Subscriber: EventSubscriberClass;
}

const SUBSCRIBER_FILE_PATTERN = /subscribers\.(cjs|cts|js|ts)$/;
const SUBSCRIBER_ROOTS = [
    'modules',
    'core/runtime/infrastructure/events'
];

const isEventSubscriberClass = (value: unknown): value is EventSubscriberClass => {
    if (typeof value !== 'function') {
        return false;
    }

    const candidate = value as EventSubscriberClass;

    return typeof candidate.subscribedTo === 'string'
        && typeof candidate.prototype?.handle === 'function';
};

const discoverSubscribers = (): Promise<DiscoveredEventSubscriber[]> => {
    return discoverModuleExports<DiscoveredEventSubscriber>({
        filePattern: SUBSCRIBER_FILE_PATTERN,
        roots: SUBSCRIBER_ROOTS,
        mapExport: ({ exportName, relativePath }, exportedValue) => {
            if (!isEventSubscriberClass(exportedValue)) {
                return null;
            }

            return {
                registrationName: `${relativePath}.${exportName}`,
                Subscriber: exportedValue
            };
        }
    });
};

export const registerDaemonEventSubscribers = async (
    container: AwilixContainer,
    eventBus: IEventBus
): Promise<void> => {
    logger.info('@event-bus: Registering cluster daemon subscribers');

    for (const { registrationName, Subscriber } of await discoverSubscribers()) {
        container.register({
            [registrationName]: asClass(Subscriber).scoped()
        });

        await eventBus.subscribe(Subscriber.subscribedTo, {
            handle: (event: IDomainEvent) => {
                return resolveScopedRegistration<IEventHandler>(
                    container,
                    registrationName,
                    { event }
                ).handle(event);
            }
        });
    }

    logger.info('@event-bus: Cluster daemon subscribers registered');
};
