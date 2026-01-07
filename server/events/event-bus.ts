/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import Redis from 'ioredis';
import { createRedisClient } from '@/config/redis';
import logger from '@/logger';

type EventHandler = (payload: any) => void | Promise<void>;

/**
 * Centralized Event Bus using Redis Pub/Sub (Observer Pattern).
 * 
 * Provides a singleton interface for publishing and subscribing to events
 * across the application without creating multiple Redis connections.
 */
class EventBus {
    private pub: Redis | null = null;
    private sub: Redis | null = null;
    private handlers = new Map<string, Set<EventHandler>>();
    private isSubscribed = new Set<string>();
    private initialized = false;

    /**
     * Initialize Redis connections for pub/sub
     */
    private async ensureInitialized(): Promise<void> {
        if (this.initialized) return;

        this.pub = createRedisClient();
        this.sub = createRedisClient();

        this.pub.on('error', (e) => logger.error(`[EventBus] Publisher error: ${e}`));
        this.sub.on('error', (e) => logger.error(`[EventBus] Subscriber error: ${e}`));

        this.sub.on('message', (channel: string, message: string) => {
            this.handleMessage(channel, message);
        });

        this.initialized = true;
        logger.info('[EventBus] Initialized');
    }

    /**
     * Handle incoming message from Redis
     */
    private handleMessage(channel: string, message: string): void {
        const handlers = this.handlers.get(channel);
        if (!handlers || handlers.size === 0) return;

        let payload: any;
        try {
            payload = JSON.parse(message);
        } catch {
            payload = message;
        }

        for (const handler of handlers) {
            try {
                const result = handler(payload);
                if (result instanceof Promise) {
                    result.catch((err) => {
                        logger.error(`[EventBus] Handler error on ${channel}: ${err}`);
                    });
                }
            } catch (err) {
                logger.error(`[EventBus] Handler error on ${channel}: ${err}`);
            }
        }
    }

    /**
     * Publish an event to a channel
     */
    async emit(channel: string, payload: any): Promise<void> {
        await this.ensureInitialized();
        const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
        await this.pub!.publish(channel, message);
    }

    /**
     * Subscribe to a channel
     */
    async on(channel: string, handler: EventHandler): Promise<void> {
        await this.ensureInitialized();

        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, new Set());
        }
        this.handlers.get(channel)!.add(handler);

        if (!this.isSubscribed.has(channel)) {
            await this.sub!.subscribe(channel);
            this.isSubscribed.add(channel);
            logger.info(`[EventBus] Subscribed to channel: ${channel}`);
        }
    }

    /**
     * Unsubscribe a handler from a channel
     */
    async off(channel: string, handler: EventHandler): Promise<void> {
        const handlers = this.handlers.get(channel);
        if (!handlers) return;

        handlers.delete(handler);

        if (handlers.size === 0) {
            this.handlers.delete(channel);
            if (this.isSubscribed.has(channel) && this.sub) {
                await this.sub.unsubscribe(channel);
                this.isSubscribed.delete(channel);
                logger.info(`[EventBus] Unsubscribed from channel: ${channel}`);
            }
        }
    }

    /**
     * Close all connections
     */
    async close(): Promise<void> {
        if (this.sub) {
            await this.sub.quit();
            this.sub = null;
        }
        if (this.pub) {
            await this.pub.quit();
            this.pub = null;
        }
        this.handlers.clear();
        this.isSubscribed.clear();
        this.initialized = false;
        logger.info('[EventBus] Closed');
    }
}

// Export singleton instance
export const eventBus = new EventBus();

// Export common channel names
export const EventChannels = {
    JOB_UPDATES: 'job_updates',
    TRAJECTORY_UPDATES: 'trajectory_updates',
    NOTIFICATION_CREATED: 'notification:created',
} as const;
