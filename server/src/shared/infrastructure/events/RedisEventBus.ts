import { Redis } from 'ioredis';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { createRedisClient } from '@core/config/redis';
import { singleton } from 'tsyringe';
import logger from '@shared/infrastructure/logger';

@singleton()
export default class RedisEvent implements IEventBus{
    private publisher: Redis;
    private subscriber: Redis;
  
    // Map for linking event names (strings) with their handlers
    private handlers: Map<string, IEventHandler<any>[]> = new Map();

    constructor(){
        this.publisher = createRedisClient();
        this.subscriber = createRedisClient();

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

        await this.subscriber.subscribe(eventName, (error) => {
            if(error){
                logger.error(`@redis-event-bus: Failed to subscribe to ${eventName}: ${error.message}`);
                return;
            }

            logger.info(`@redis-event-bus: Subscribed to ${eventName}`);
        });
    }

    /**
     * Centralized listening for messages arriving at Redis.
     */
    private initializeSubscriberListener(): void{
        this.subscriber.on('message', async (channel, message) => {
            const handlers = this.handlers.get(channel);
            if(!handlers || handlers.length === 0) return;

            try{
                const eventData = JSON.parse(message);
                // Execute all handlers associated for this event.
                await Promise.allSettled(handlers.map((handler) => handler.handle(eventData)));
            }catch(error){
                logger.error(`@redis-event-bus: error processing message on channel ${channel}: ${error}`);
            }
        });
    }
};