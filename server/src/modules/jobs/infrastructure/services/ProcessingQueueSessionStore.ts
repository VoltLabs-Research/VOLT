import IORedis from 'ioredis';
import {
    ProcessingQueueSessionRecord,
    SESSION_TTL_SECONDS,
    SessionDrainResult,
    SessionFailureSummaryRecord
} from '@modules/jobs/infrastructure/services/ProcessingQueueShared';
import type { WorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';

export default class ProcessingQueueSessionStore {
    constructor(private readonly redis: IORedis) {}

    private sessionKey(sessionId: string): string {
        return `session:${sessionId}`;
    }

    private remainingKey(sessionId: string): string {
        return `session:${sessionId}:remaining`;
    }

    private failureSummaryKey(sessionId: string): string {
        return `session:${sessionId}:failure-summary`;
    }

    async persistSession(sessionData: ProcessingQueueSessionRecord): Promise<void> {
        const pipeline = this.redis.pipeline();

        pipeline.setex(this.sessionKey(sessionData.sessionId), SESSION_TTL_SECONDS, JSON.stringify(sessionData));
        pipeline.set(this.remainingKey(sessionData.sessionId), sessionData.totalJobs.toString());
        pipeline.expire(this.remainingKey(sessionData.sessionId), SESSION_TTL_SECONDS);
        pipeline.del(this.failureSummaryKey(sessionData.sessionId));

        await pipeline.exec();
    }

    async recordFailure(sessionId: string, failure: WorkerFailureEnvelope): Promise<void> {
        const failureSummaryKey = this.failureSummaryKey(sessionId);
        const currentFailureSummary = await this.redis.get(failureSummaryKey);

        let failedJobs = 0;
        if (currentFailureSummary) {
            try {
                const parsedFailureSummary = JSON.parse(currentFailureSummary) as SessionFailureSummaryRecord;
                if (typeof parsedFailureSummary.failedJobs === 'number') {
                    failedJobs = parsedFailureSummary.failedJobs;
                }
            } catch {
                failedJobs = 0;
            }
        }

        const nextFailureSummary: SessionFailureSummaryRecord = {
            failedJobs: failedJobs + 1,
            lastFailure: failure
        };

        await this.redis.set(
            failureSummaryKey,
            JSON.stringify(nextFailureSummary),
            'EX',
            SESSION_TTL_SECONDS
        );
    }

    async completeSessionIfDrained(sessionId: string): Promise<SessionDrainResult> {
        const luaScript = `
            local ttl = tonumber(ARGV[1])
            redis.call('EXPIRE', KEYS[1], ttl)
            redis.call('EXPIRE', KEYS[2], ttl)
            redis.call('EXPIRE', KEYS[3], ttl)

            local remaining = redis.call('DECR', KEYS[1])
            if remaining <= 0 then
                local sessionData = redis.call('GET', KEYS[2])
                local failureSummary = redis.call('GET', KEYS[3])
                redis.call('DEL', KEYS[2])
                redis.call('DEL', KEYS[1])
                redis.call('DEL', KEYS[3])
                return {1, sessionData or '', failureSummary or ''}
            end
            return {0, '', ''}
        `;

        const [shouldComplete, sessionDataRaw, failureSummaryRaw] = await this.redis.eval(
            luaScript,
            3,
            this.remainingKey(sessionId),
            this.sessionKey(sessionId),
            this.failureSummaryKey(sessionId),
            SESSION_TTL_SECONDS
        ) as [number, string, string];

        if (shouldComplete !== 1) {
            return { completed: false };
        }

        if (!sessionDataRaw) {
            return {
                completed: true,
                missingSessionData: true
            };
        }

        try {
            return {
                completed: true,
                sessionData: JSON.parse(sessionDataRaw) as ProcessingQueueSessionRecord,
                failureSummary: this.parseSessionFailureSummary(failureSummaryRaw)
            };
        } catch {
            return {
                completed: true,
                missingSessionData: true
            };
        }
    }

    private parseSessionFailureSummary(rawValue: string | null): SessionFailureSummaryRecord | undefined {
        if (!rawValue) {
            return undefined;
        }

        try {
            const parsedValue = JSON.parse(rawValue) as SessionFailureSummaryRecord;
            if (typeof parsedValue.failedJobs !== 'number') {
                return undefined;
            }

            return {
                failedJobs: parsedValue.failedJobs,
                lastFailure: parsedValue.lastFailure
            };
        } catch {
            return undefined;
        }
    }
}
