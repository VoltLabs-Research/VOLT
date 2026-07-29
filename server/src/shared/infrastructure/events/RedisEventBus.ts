import logger from '@shared/infrastructure/logger';
import { Redis } from 'ioredis';
import { v4 } from 'uuid';
import redisClient from '@shared/infrastructure/redis/redisClient';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { EventName } from '@shared/events/EventGroup';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

class RedisEventBus implements IEventBus {
    private publisher: Redis;
    private subscriber: Redis;

    private handlers: Map<string, IEventHandler<IDomainEvent>[]> = new Map();
    private subscribedChannels: Set<string> = new Set();
    private pendingSubscriptions: Map<string, Promise<void>> = new Map();

    constructor() {
        this.publisher = redisClient.duplicate();
        this.subscriber = redisClient.duplicate();

        this.initializeSubscriberListener();
    }

    public async emit<K extends EventName>(name: K, payload: EventMap[K]): Promise<void> {
        const event: IDomainEvent<EventMap[K]> = {
            name,
            payload,
            eventId: v4(),
            occurredOn: new Date()
        };

        await this.publisher.publish(name, JSON.stringify(event));
        logger.info(`@redis-event-bus: Published ${name} to Redis`);
    }

    public async subscribe<T extends IDomainEvent>(
        eventName: string,
        handler: IEventHandler<T>
    ): Promise<void> {
        if (!this.handlers.has(eventName)) {
            this.handlers.set(eventName, []);
        }

        this.handlers.get(eventName)!.push(handler);
        logger.info(`@redis-event-bus: ${handler.label ?? handler.constructor.name} registered for ${eventName}`);

        if (this.subscribedChannels.has(eventName)) {
            return;
        }

        const pendingSubscription = this.pendingSubscriptions.get(eventName);
        if (pendingSubscription) {
            await pendingSubscription;
            return;
        }

        const subscription = this.subscriber.subscribe(eventName)
            .then(() => {
                this.subscribedChannels.add(eventName);
                logger.info(`@redis-event-bus: Subscribed Redis client to ${eventName}`);
            })
            .catch((error: Error) => {
                logger.error(`@redis-event-bus: Failed to subscribe to ${eventName}: ${error.message}`);
                throw error;
            })
            .finally(() => {
                this.pendingSubscriptions.delete(eventName);
            });

        this.pendingSubscriptions.set(eventName, subscription);
        await subscription;
    }

    private initializeSubscriberListener(): void {
        this.subscriber.on('message', async (channel, message) => {
            const handlers = this.handlers.get(channel);
            if (!handlers || handlers.length === 0) return;

            const snapshot = handlers.slice();

            let eventData: unknown;
            try {
                eventData = JSON.parse(message);
            } catch (error) {
                logger.error(`@redis-event-bus: error parsing message on channel ${channel}: ${error}`);
                return;
            }

            const results = await Promise.allSettled(snapshot.map((handler) => handler.handle(eventData as IDomainEvent)));
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result.status === 'rejected') {
                    const handler = snapshot[i];
                    logger.error(
                        result.reason,
                        `@redis-event-bus: ${handler.label ?? handler.constructor.name} for channel "${channel}" rejected`
                    );
                }
            }
        });
    }
}

export default new RedisEventBus();
