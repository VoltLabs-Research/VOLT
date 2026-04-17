import crypto from 'node:crypto';

import { logger } from '@/core/logger';
import { DelayedError } from 'bullmq';
import type { Job } from 'bullmq';

import type { RedisConnectionService } from '@/core/storage/infrastructure/redis/RedisConnectionService';

const DEFAULT_LEASE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_HEARTBEAT_MS = 60 * 1000;
const DEFAULT_CONTENTION_DELAY_MS = 5 * 1000;

type QueueScopeKind = 'trajectory' | 'team';

interface QueueScopeConstraint {
    scope: QueueScopeKind;
    scopeId: string;
    limit: number;
};

export interface QueueScopeLease {
    release(): Promise<void>;
};

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

const buildQueueScopeKey = (queueName: string, constraint: QueueScopeConstraint): string => {
    return `queue-scope:${queueName}:${constraint.scope}:${constraint.scopeId}`;
};

const createScopeLabel = (constraint: QueueScopeConstraint): string => {
    return `${constraint.scope}:${constraint.scopeId}`;
};

export const tryAcquireQueueScopeLease = async (
    redisConnectionService: RedisConnectionService,
    queueName: string,
    constraints: QueueScopeConstraint[],
    options: AcquireQueueScopeLeaseOptions = {}
): Promise<{ lease: QueueScopeLease | null; blockingScope: QueueScopeConstraint | null }> => {
    const applicableConstraints = constraints
        .filter((constraint) => constraint.limit > 0 && constraint.scopeId.trim().length > 0)
        .sort((left, right) => left.scope.localeCompare(right.scope) || left.scopeId.localeCompare(right.scopeId));

    if (applicableConstraints.length === 0) {
        return {
            lease: {
                async release(): Promise<void> {}
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
        const scopeKey = buildQueueScopeKey(queueName, constraint);
        const acquired = await redisConnectionService.tryAcquireExpiringSlot(scopeKey, token, constraint.limit, ttlMs);

        if (!acquired) {
            for (const acquiredKey of acquiredKeys) {
                await redisConnectionService.releaseExpiringSlot(acquiredKey, token, ttlMs).catch((error: unknown) => {
                    logger.warn(
                        {
                            err: error,
                            acquiredKey,
                            queueName
                        },
                        'Failed to rollback partially acquired queue scope slot'
                    );
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
            const constraint = applicableConstraints[index]!;
            redisConnectionService.renewExpiringSlot(scopeKey, token, ttlMs)
                .then((renewed) => {
                    if (!renewed) {
                        logger.warn(
                            {
                                queueName,
                                scopeKey,
                                scopeLabel: createScopeLabel(constraint)
                            },
                            'Failed to renew queue scope slot'
                        );
                    }
                })
                .catch((error: unknown) => {
                    logger.warn(
                        {
                            err: error,
                            queueName,
                            scopeKey,
                            scopeLabel: createScopeLabel(constraint)
                        },
                        'Queue scope slot heartbeat failed'
                    );
                });
        }
    }, heartbeatMs);

    heartbeat.unref?.();

    return {
        lease: {
            async release(): Promise<void> {
                if (released) {
                    return;
                }

                released = true;
                clearInterval(heartbeat);

                for (const scopeKey of acquiredKeys) {
                    await redisConnectionService.releaseExpiringSlot(scopeKey, token, ttlMs).catch((error: unknown) => {
                        logger.warn(
                            {
                                err: error,
                                queueName,
                                scopeKey
                            },
                            'Failed to release queue scope slot'
                        );
                    });
                }
            }
        },
        blockingScope: null
    };
};

export const delayJobOnQueueScopeContention = async <T extends object>(
    bullJob: Job<T>,
    options: DelayJobOnQueueScopeContentionOptions
): Promise<void> => {
    const delayMs = options.delayMs ?? DEFAULT_CONTENTION_DELAY_MS;

    logger.info(
        {
            delayMs,
            jobId: options.jobId,
            queueName: options.queueName,
            scope: options.scope.scope,
            scopeId: options.scope.scopeId,
            limit: options.scope.limit
        },
        'Delaying queue job because the configured scope limit is currently saturated'
    );

    await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
    throw new DelayedError();
};
