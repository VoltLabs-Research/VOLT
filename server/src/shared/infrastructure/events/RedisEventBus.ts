import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { Redis } from 'ioredis';
import { inject, singleton } from 'tsyringe';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IDomainEvent } from '@shared/application/events/IDomainEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';

@singleton()
export default class RedisEventBus implements IEventBus{
    private publisher: Redis;
    private subscriber: Redis;
  
    private handlers: Map<string, IEventHandler<IDomainEvent>[]> = new Map();
    private subscribedChannels: Set<string> = new Set();
    private pendingSubscriptions: Map<string, Promise<void>> = new Map();

    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        redisClient: Redis
    ){
        this.publisher = redisClient.duplicate();
        this.subscriber = redisClient.duplicate();

        this.initializeSubscriberListener();
    }

    public async publish(event: IDomainEvent): Promise<void>{
        const payload = JSON.stringify(event);
        await this.publisher.publish(event.name, payload);
        logger.info(`@redis-event-bus: Published ${event.name} to Redis`);
    }

    public async subscribe<T extends IDomainEvent>(
        eventName: string,
        handler: IEventHandler<T>
    ): Promise<void>{
        if(!this.handlers.has(eventName)){
            this.handlers.set(eventName, []);
        }

        this.handlers.get(eventName)!.push(handler);
        logger.info(`@redis-event-bus: ${handler.constructor.name} registered for ${eventName}`);

        if(this.subscribedChannels.has(eventName)){
            return;
        }

        const pendingSubscription = this.pendingSubscriptions.get(eventName);
        if(pendingSubscription){
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

    private initializeSubscriberListener(): void{
        this.subscriber.on('message', async (channel, message) => {
            const handlers = this.handlers.get(channel)!;

            try{
                const eventData = JSON.parse(message);
                const results = await Promise.allSettled(handlers.map((handler) => handler.handle(eventData)));
                for(let i = 0; i < results.length; i++){
                    const result = results[i];
                    if(result.status === 'rejected'){
                        logger.error(
                            result.reason,
                            `@redis-event-bus: handler[${i}] for channel "${channel}" rejected`
                        );
                    }
                }
            }catch(error){
                logger.error(`@redis-event-bus: error processing message on channel ${channel}: ${error}`);
            }
        });
    }
};
