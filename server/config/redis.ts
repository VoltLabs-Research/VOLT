/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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
import logger from '@/logger';

const getRedisConfig = () => {
    const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null
    };

    return redisConfig;
};

export const createRedisConnection = () => {
    return new Redis(getRedisConfig());
};

export let redis: Redis | null = null;

export const initializeRedis = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if(redis) {
            resolve();
            return;
        }

        redis = new Redis(getRedisConfig());

        redis.on('connect', () => {
            logger.info('Redis connected successfully');
        });

        redis.on('error', (err) => {
            logger.error(`Redis connection error: ${err}`);
        });

        redis.on('ready', () => {
            logger.info('Redis is ready to accept commands');
            resolve();
        });

        // Add a timeout in case Redis never becomes ready
        setTimeout(() => {
            if (redis?.status !== 'ready') {
                logger.warn('Redis initialization timeout - continuing anyway');
                resolve();
            }
        }, 5000);
    });
};

export const createRedisClient = () => {
    return new Redis(getRedisConfig());
};