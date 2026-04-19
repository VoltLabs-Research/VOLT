import { asClass, type AwilixContainer } from 'awilix';
import { discoverModuleExports } from '@/app/bootstrap/module-discovery';
import { resolveScopedRegistration } from '@/app/bootstrap/scoped-resolution';
import type { IDomainEvent } from '@/core/events/i-domain-event';
import { getEventGroupMetadata, type EventMethodMetadata } from '@/core/events/decorators';
import { logger } from '@/core/logger';

export type EventHandler = (event: IDomainEvent) => Promise<void> | void;

interface EventGroupClass {
    new (...args: readonly unknown[]): object;
}

interface DiscoveredEventGroup {
    registrationName: string;
    Group: EventGroupClass;
    namespace: string;
    events: readonly EventMethodMetadata[];
}

const EVENT_FILE_PATTERN = /Events\.(cjs|cts|js|ts)$/;
const EVENT_ROOTS = [
    'modules',
    'core/runtime/infrastructure/events'
];

export class EventDispatcher {
    private readonly handlers = new Map<string, Set<EventHandler>>();

    async registerDecoratedGroups(container: AwilixContainer): Promise<void> {
        logger.info('@event-dispatcher: Registering cluster daemon subscribers');

        for (const { registrationName, Group, namespace, events } of await this.discoverEventGroups()) {
            container.register({
                [registrationName]: asClass(Group).scoped()
            });

            for (const eventMetadata of events) {
                this.subscribe(this.buildEventName(namespace, eventMetadata.name), (event) => {
                    const eventGroup = resolveScopedRegistration<Record<string, (event: IDomainEvent) => Promise<void> | void>>(
                        container,
                        registrationName,
                        {}
                    );

                    return eventGroup[eventMetadata.propertyKey](event);
                });
            }
        }

        logger.info('@event-dispatcher: Cluster daemon subscribers registered');
    }

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

    private buildEventName(namespace: string, name: string): string {
        return `${namespace}.${name}`;
    }

    private discoverEventGroups(): Promise<DiscoveredEventGroup[]> {
        return discoverModuleExports<DiscoveredEventGroup>({
            filePattern: EVENT_FILE_PATTERN,
            roots: EVENT_ROOTS,
            mapExport: ({ exportName, relativePath }, exportedValue) => {
                const metadata = getEventGroupMetadata(exportedValue);

                if (!metadata) {
                    return null;
                }

                return {
                    registrationName: `event-group:${relativePath}.${exportName}`,
                    Group: exportedValue as EventGroupClass,
                    namespace: metadata.namespace,
                    events: metadata.events
                };
            }
        });
    }
}
