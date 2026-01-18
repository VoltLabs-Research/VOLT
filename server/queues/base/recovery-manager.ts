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

import IORedis from 'ioredis';
import { BaseJob } from '@/types/queues/base-processing-queue';
import { QUEUE_DEFAULTS } from '@/config/queue-defaults';
import { asyncForEach } from '@/utilities/runtime/async-loop';
import logger from '@/logger';

export interface RecoveryManagerConfig {
    queueKey: string;
    processingKey: string;
    statusKeyPrefix: string;
    logPrefix: string;
}

export interface JobDeserializer<T extends BaseJob> {
    (rawData: string): T;
}

/**
 * Manages crash recovery and startup operations for the queue.
 * Handles requeuing stale jobs and distributed locking.
 */
export class RecoveryManager<T extends BaseJob> {
    constructor(
        private readonly redis: IORedis,
        private readonly config: RecoveryManagerConfig,
        private readonly deserializeJob: JobDeserializer<T>
    ){}

    private logInfo(message: string): void {
        logger.info(`${this.config.logPrefix} ${message}`);
    }

    /**
     * Execute a function with a distributed startup lock
     */
    async withStartupLock<R>(fn: () => Promise<R>): Promise<R | undefined> {
        const lockKey = `${this.config.queueKey}:startup_lock`;
        const ttlMs = QUEUE_DEFAULTS.STARTUP_LOCK_TTL_MS;
        const lockVal = `${process.pid}:${Date.now()}`;

        const lua = `
            local ok = redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX')
            if ok then return 1 else return 0 end
        `;

        const acquired = await this.redis.eval(lua, 1, lockKey, lockVal, String(ttlMs)) as number;
        if (acquired !== 1) {
            this.logInfo(`Startup recovery already running elsewhere, skipping.`);
            return;
        }

        try {
            return await fn();
        } finally {
            await this.redis.del(lockKey).catch(() => { });
        }
    }

    /**
     * Drain jobs from processing list back to queue
     */
    async drainProcessingIntoQueue(): Promise<number> {
        const lua = `
            local src = KEYS[1]
            local dst = KEYS[2]
            local moved = 0
            while true do
            local v = redis.call('RPOPLPUSH', src, dst)
            if not v then break end
            moved = moved + 1
            end
            return moved
        `;
        const moved = await this.redis.eval(
            lua,
            2,
            this.config.processingKey,
            this.config.queueKey
        ) as number;

        if (moved && moved > 0) {
            this.logInfo(`Recovered ${moved} jobs from processing.`);
        }
        return moved || 0;
    }

    /**
     * Requeue jobs that were running during a crash/restart
     */
    async requeueStaleRunningJobs(): Promise<void> {
        let cursor = '0';
        const match = `${this.config.statusKeyPrefix}*`;
        const { setImmediate } = await import('node:timers/promises');

        do {
            const resp = await this.redis.scan(cursor, 'MATCH', match, 'COUNT', 500);
            cursor = resp[0];
            const keys: string[] = resp[1];
            if (keys.length === 0) continue;

            const pipeline = this.redis.pipeline();
            keys.forEach(k => pipeline.get(k));
            const results: any = await pipeline.exec();

            await asyncForEach(results, 100, async (item: unknown) => {
                const [, raw] = item as [any, any];
                if (!raw) return;
                try {
                    const data = JSON.parse(raw);
                    if (data?.status !== 'running') return;
                    const jobObj = this.deserializeJob(JSON.stringify(data));
                    const rawData = JSON.stringify(jobObj);

                    const [inQueue, inProc] = await Promise.all([
                        this.redis.lpos(this.config.queueKey, rawData),
                        this.redis.lpos(this.config.processingKey, rawData)
                    ]);
                    if (inQueue === null && inProc === null) {
                        await this.redis.lpush(this.config.queueKey, rawData);
                    }

                    // Update status to indicate requeue
                    const statusKey = `${this.config.statusKeyPrefix}${data.jobId}`;
                    const statusData = {
                        ...data,
                        status: 'requeued_after_restart',
                        note: 'Job was running during a server restart and has been requeued safely.',
                        timestamp: new Date().toISOString()
                    };
                    await this.redis.set(statusKey, JSON.stringify(statusData), 'EX', QUEUE_DEFAULTS.TTL_SECONDS);
                } catch (_e) {
                    // Ignore parse errors
                }
            });

            await setImmediate();
        } while (cursor !== '0');
    }

    /**
     * Perform full startup recovery
     */
    async recoverOnStartup(): Promise<void> {
        await this.withStartupLock(async () => {
            await this.drainProcessingIntoQueue();
            await this.requeueStaleRunningJobs();
        });
    }
}
