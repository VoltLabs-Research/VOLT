import crypto from 'node:crypto';

import logger from '@shared/infrastructure/logger';
import type IORedis from 'ioredis';
import { DelayedError } from 'bullmq';
import type { Job } from 'bullmq';

const DEFAULT_LEASE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_HEARTBEAT_MS = 60 * 1000;
const DEFAULT_CONTENTION_DELAY_MS = 5 * 1000;
const ACQUIRE_EXPIRING_SLOT_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local current = redis.call('ZCARD', KEYS[1])
if current < tonumber(ARGV[3]) then
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[4])
    redis.call('PEXPIRE', KEYS[1], ARGV[5])
    return 1
end
return 0
`;
const RENEW_EXPIRING_SLOT_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
local score = redis.call('ZSCORE', KEYS[1], ARGV[3])
if score then
    redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
    redis.call('PEXPIRE', KEYS[1], ARGV[4])
    return 1
end
return 0
`;
const RELEASE_EXPIRING_SLOT_SCRIPT = `
local removed = redis.call('ZREM', KEYS[1], ARGV[1])
local remaining = redis.call('ZCARD', KEYS[1])
if remaining <= 0 then
    redis.call('DEL', KEYS[1])
else
    redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return removed
`;

export type QueueScopeKind = 'trajectory' | 'team';

export interface QueueScopeConstraint {
    scope: QueueScopeKind;
    scopeId: string;
    limit: number;
}

export interface QueueScopeLease {
    release(): Promise<void>;
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

const buildQueueScopeKey = (queueName: string, constraint: QueueScopeConstraint): string => (
    `queue-scope:${queueName}:${constraint.scope}:${constraint.scopeId}`
);

const createScopeLabel = (constraint: QueueScopeConstraint): string => (
    `${constraint.scope}:${constraint.scopeId}`
);

const tryAcquireSlot = async (
    redis: IORedis,
    scopeKey: string,
    token: string,
    limit: number,
    ttlMs: number
): Promise<boolean> => {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const result = await redis.eval(
        ACQUIRE_EXPIRING_SLOT_SCRIPT,
        1,
        scopeKey,
        String(now),
        String(expiresAt),
        String(limit),
        token,
        String(ttlMs)
    );

    return result === 1;
};

const renewSlot = async (
    redis: IORedis,
    scopeKey: string,
    token: string,
    ttlMs: number
): Promise<boolean> => {
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const result = await redis.eval(
        RENEW_EXPIRING_SLOT_SCRIPT,
        1,
        scopeKey,
        String(now),
        String(expiresAt),
        token,
        String(ttlMs)
    );

    return result === 1;
};

const releaseSlot = async (
    redis: IORedis,
    scopeKey: string,
    token: string,
    ttlMs: number
): Promise<boolean> => {
    const result = await redis.eval(
        RELEASE_EXPIRING_SLOT_SCRIPT,
        1,
        scopeKey,
        token,
        String(ttlMs)
    );

    return result === 1;
};

export const tryAcquireQueueScopeLease = async (
    redis: IORedis,
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
        const acquired = await tryAcquireSlot(redis, scopeKey, token, constraint.limit, ttlMs);

        if (!acquired) {
            for (const acquiredKey of acquiredKeys) {
                await releaseSlot(redis, acquiredKey, token, ttlMs).catch((error: unknown) => {
                    logger.warn(
                        {
                            err: error,
                            acquiredKey,
                            queueName
                        },
                        '@queue-scope: failed to rollback partially acquired queue scope slot'
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
            void renewSlot(redis, scopeKey, token, ttlMs)
                .then((renewed) => {
                    if (!renewed) {
                        logger.warn(
                            {
                                queueName,
                                scopeKey,
                                scopeLabel: createScopeLabel(constraint)
                            },
                            '@queue-scope: failed to renew queue scope slot'
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
                        '@queue-scope: heartbeat failed'
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
                    await releaseSlot(redis, scopeKey, token, ttlMs).catch((error: unknown) => {
                        logger.warn(
                            {
                                err: error,
                                queueName,
                                scopeKey
                            },
                            '@queue-scope: failed to release queue scope slot'
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

    await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
    throw new DelayedError();
};
