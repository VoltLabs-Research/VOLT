import redisClient from '@shared/infrastructure/redis/redisClient';
import type { JobStatus } from '@shared/contracts/types';

const SESSION_TTL_SECONDS = 86400;

const DECREMENT_DRAIN_SCRIPT = `
local ttl = tonumber(ARGV[1])
if redis.call('EXISTS', KEYS[1]) == 0 then
    return {0, 0}
end
redis.call('EXPIRE', KEYS[1], ttl)

local remaining = redis.call('DECR', KEYS[1])
if remaining <= 0 then
    local failedJobs = tonumber(redis.call('GET', KEYS[2]) or '0')
    redis.call('DEL', KEYS[1])
    redis.call('DEL', KEYS[2])
    return {1, failedJobs}
end
return {0, 0}
`;

const INITIALIZE_SESSION_SCRIPT = `
local remainingKey = KEYS[1]
local failedKey = KEYS[2]
local terminalReceiptSetKey = KEYS[3]
local totalJobs = tonumber(ARGV[1])
local ttlSeconds = tonumber(ARGV[2])

local terminalCount = redis.call('SCARD', terminalReceiptSetKey)
local failedCount = tonumber(redis.call('GET', failedKey) or '0')
local remaining = totalJobs - terminalCount
if remaining < 0 then remaining = 0 end

if remaining > 0 then
    redis.call('SET', remainingKey, tostring(remaining), 'EX', ttlSeconds)
else
    redis.call('DEL', remainingKey)
end

if redis.call('EXISTS', failedKey) == 1 then
    redis.call('EXPIRE', failedKey, ttlSeconds)
end
if redis.call('EXISTS', terminalReceiptSetKey) == 1 then
    redis.call('EXPIRE', terminalReceiptSetKey, ttlSeconds)
end

return { remaining, failedCount }
`;

export interface DaemonSessionKeys {
    remaining: string;
    failed: string;
    terminalSet: string;
    terminal: (jobId: string) => string;
}

export interface DaemonSessionInitialization {
    remainingJobs: number;
    failedJobs: number;
}

export interface DaemonSessionDrainResult {
    drained: boolean;
    failedJobs: number;
}

const sessionKeys = (namespace: string, id: string): DaemonSessionKeys => {
    const base = `${namespace}:${id}`;
    return {
        remaining: `${base}:remaining`,
        failed: `${base}:failed`,
        terminalSet: `${base}:terminal-keys`,
        terminal: (jobId: string) => `${base}:terminal:${jobId}`
    };
};

/**
 * Redis bookkeeping for a daemon job session: how many jobs are still
 * outstanding, how many of them failed, and which job receipts already reached
 * a terminal state so that duplicate daemon reports stay idempotent.
 */
class DaemonAnalysisSessionStore {
    private readonly redis = redisClient;

    analysisKeys(analysisId: string): DaemonSessionKeys {
        return sessionKeys('daemon-analysis', analysisId);
    }

    glbKeys(trajectoryId: string): DaemonSessionKeys {
        return sessionKeys('daemon-glb', trajectoryId);
    }

    async initialize(keys: DaemonSessionKeys, totalJobs: number): Promise<DaemonSessionInitialization> {
        const [remainingJobs, failedJobs] = await this.redis.eval(
            INITIALIZE_SESSION_SCRIPT,
            3,
            keys.remaining,
            keys.failed,
            keys.terminalSet,
            totalJobs.toString(),
            SESSION_TTL_SECONDS.toString()
        ) as [number, number];

        return {
            remainingJobs,
            failedJobs
        };
    }

    async tryMarkTerminalReceipt(keys: DaemonSessionKeys, jobId: string, status: JobStatus): Promise<boolean> {
        const receiptKey = keys.terminal(jobId);
        const result = await this.redis.set(receiptKey, status, 'EX', SESSION_TTL_SECONDS, 'NX');
        if (result !== 'OK') {
            return false;
        }

        const pipeline = this.redis.pipeline();
        pipeline.sadd(keys.terminalSet, receiptKey);
        pipeline.expire(keys.terminalSet, SESSION_TTL_SECONDS);
        await pipeline.exec();

        return true;
    }

    async hasTerminalReceipt(keys: DaemonSessionKeys, jobId: string): Promise<boolean> {
        return (await this.redis.exists(keys.terminal(jobId))) === 1;
    }

    async recordFailure(keys: DaemonSessionKeys): Promise<void> {
        await this.redis.incr(keys.failed);
        await this.redis.expire(keys.failed, SESSION_TTL_SECONDS);
    }

    async decrementAndCheckDrain(keys: DaemonSessionKeys): Promise<DaemonSessionDrainResult> {
        const [drained, failedJobs] = await this.redis.eval(
            DECREMENT_DRAIN_SCRIPT,
            2,
            keys.remaining,
            keys.failed,
            SESSION_TTL_SECONDS
        ) as [number, number];

        return {
            drained: drained === 1,
            failedJobs
        };
    }
}

export default new DaemonAnalysisSessionStore();
