import crypto from 'node:crypto';

import { logger } from '@/core/logger';
import type { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import { DelayedError } from 'bullmq';

type QueueScopeKind = 'trajectory' | 'team';

interface QueueScopeConstraint {
    scope: QueueScopeKind;
    scopeId: string;
    limit: number;
}

export interface QueueScopeLease {
    release(): Promise<void>;
}

interface AcquireQueueScopeLeaseResult {
    lease: QueueScopeLease | null;
    blockingScope: QueueScopeConstraint | null;
}

interface AcquireQueueScopeLeaseOptions {
    ttlMs?: number;
    heartbeatMs?: number;
}

interface DelayJobOnQueueScopeContentionOptions {
    queueName: string;
    jobId: string;
    scope: QueueScopeConstraint;
    delayMs?: number;
}

interface DelayableQueueJob {
    token?: string;
    moveToDelayed(timestamp: number, token?: string): Promise<void>;
}

const DEFAULT_LEASE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_HEARTBEAT_MS = 60 * 1000;
const DEFAULT_CONTENTION_DELAY_MS = 5 * 1000;

const createScopeLabel = (constraint: QueueScopeConstraint): string => {
    return `${constraint.scope}:${constraint.scopeId}`;
};

export const tryAcquireQueueScopeLease = async (
    redisConnection: RedisConnection,
    queueName: string,
    constraints: QueueScopeConstraint[],
    options: AcquireQueueScopeLeaseOptions = {}
): Promise<AcquireQueueScopeLeaseResult> => {
    const applicableConstraints = constraints
        .filter((constraint) => constraint.limit > 0 && constraint.scopeId.length > 0)
        .sort((left, right) => left.scope.localeCompare(right.scope) || left.scopeId.localeCompare(right.scopeId));

    if (applicableConstraints.length === 0) {
        return {
            lease: {
                release: () => Promise.resolve()
            },
            blockingScope: null
        };
    }

    const ttlMs = options.ttlMs ?? DEFAULT_LEASE_TTL_MS;
    const heartbeatMs = Math.max(1_000, Math.min(options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS, Math.floor(ttlMs / 2)));
    const token = crypto.randomUUID();
    const acquiredKeys: string[] = [];
    let released = false;

    for (const constraint of applicableConstraints) {
        const scopeKey = `queue-scope:${queueName}:${constraint.scope}:${constraint.scopeId}`;
        const acquired = await redisConnection.tryAcquireExpiringSlot(scopeKey, token, constraint.limit, ttlMs);

        if (!acquired) {
            for (const acquiredKey of acquiredKeys) {
                await redisConnection.releaseExpiringSlot(acquiredKey, token, ttlMs).catch((error) => {
                    logger.warn('Failed to rollback partially acquired queue scope slot');
                });
            }

            return {
                lease: null,
                blockingScope: constraint
            };
        }

        acquiredKeys.push(scopeKey);
    }

    const heartbeat = setInterval(() => {
        if (released) {
            return;
        }

        for (const [index, scopeKey] of acquiredKeys.entries()) {
            redisConnection.renewExpiringSlot(scopeKey, token, ttlMs)
                .then((renewed) => {
                    if (!renewed) {
                        logger.warn('Failed to renew queue scope slot');
                    }
                })
                .catch((error) => {
                    logger.warn('Queue scope slot heartbeat failed');
                });
        }
    }, heartbeatMs);

    heartbeat.unref();

    return {
        lease: {
            async release(): Promise<void> {
                if (released) {
                    return;
                }

                released = true;
                clearInterval(heartbeat);

                for (const scopeKey of acquiredKeys) {
                    await redisConnection.releaseExpiringSlot(scopeKey, token, ttlMs).catch((error) => {
                        logger.warn('Failed to release queue scope slot');
                    });
                }
            }
        },
        blockingScope: null
    };
};

export const delayJobOnQueueScopeContention = async (
    bullJob: DelayableQueueJob,
    options: DelayJobOnQueueScopeContentionOptions
): Promise<void> => {
    const delayMs = options.delayMs ?? DEFAULT_CONTENTION_DELAY_MS;

    await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
    throw new DelayedError();
};
