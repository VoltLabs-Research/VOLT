import {
    SESSION_TTL_SECONDS,
    SessionFailureSummaryRecord
} from '@modules/jobs/infrastructure/services/ProcessingQueueShared';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { isErrorCode } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import IORedis from 'ioredis';
import type { ProcessingQueueSessionRecord, SessionDrainResult } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';
import type { WorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';

type SessionEvalResponse = [number, string, string];

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
                const parsedFailureSummary = this.parseSessionFailureSummary(currentFailureSummary);
                if (parsedFailureSummary) {
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

        const evalResponse = this.getSessionEvalResponse(await this.redis.eval(
            luaScript,
            3,
            this.remainingKey(sessionId),
            this.sessionKey(sessionId),
            this.failureSummaryKey(sessionId),
            SESSION_TTL_SECONDS
        ));
        const [shouldComplete, sessionDataRaw, failureSummaryRaw] = evalResponse;

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
            const sessionData = this.parseSessionRecord(sessionDataRaw);
            if (!sessionData) {
                return {
                    completed: true,
                    missingSessionData: true
                };
            }

            return {
                completed: true,
                sessionData,
                failureSummary: this.parseSessionFailureSummary(failureSummaryRaw)
            };
        } catch {
            return {
                completed: true,
                missingSessionData: true
            };
        }
    }

    private getSessionEvalResponse(value: unknown): SessionEvalResponse {
        if (!Array.isArray(value) || value.length !== 3) {
            throw new Error('Invalid Redis session drain response');
        }

        const [shouldComplete, sessionDataRaw, failureSummaryRaw] = value;
        if (typeof shouldComplete !== 'number' || typeof sessionDataRaw !== 'string' || typeof failureSummaryRaw !== 'string') {
            throw new Error('Invalid Redis session drain response');
        }

        return [shouldComplete, sessionDataRaw, failureSummaryRaw];
    }

    private parseSessionRecord(rawValue: string): ProcessingQueueSessionRecord | undefined {
        const parsedValue = JSON.parse(rawValue);
        if (!isRecord(parsedValue)) {
            return undefined;
        }

        if (
            typeof parsedValue.sessionId !== 'string'
            || (typeof parsedValue.startTime !== 'string' && !(parsedValue.startTime instanceof Date))
            || typeof parsedValue.totalJobs !== 'number'
            || typeof parsedValue.teamId !== 'string'
            || typeof parsedValue.queueType !== 'string'
            || parsedValue.status !== 'active'
        ) {
            return undefined;
        }

        let metadata: Record<string, unknown> = {};
        if (isRecord(parsedValue.metadata)) {
            metadata = parsedValue.metadata;
        }

        return {
            sessionId: parsedValue.sessionId,
            startTime: parsedValue.startTime,
            totalJobs: parsedValue.totalJobs,
            metadata,
            teamId: parsedValue.teamId,
            queueType: parsedValue.queueType,
            status: parsedValue.status
        };
    }

    private parseWorkerFailureEnvelope(value: unknown): WorkerFailureEnvelope | undefined {
        if (!isRecord(value) || !isErrorCode(value.code)) {
            return undefined;
        }

        let message = value.code;
        if (isErrorCode(value.message)) {
            message = value.message;
        }

        let details: string | undefined;
        if (typeof value.details === 'string') {
            details = value.details;
        }

        return {
            code: value.code,
            message,
            details
        };
    }

    private parseSessionFailureSummary(rawValue: string | null): SessionFailureSummaryRecord | undefined {
        if (!rawValue) {
            return undefined;
        }

        try {
            const parsedValue = JSON.parse(rawValue);
            if (!isRecord(parsedValue) || typeof parsedValue.failedJobs !== 'number') {
                return undefined;
            }

            const lastFailure = this.parseWorkerFailureEnvelope(parsedValue.lastFailure);

            return {
                failedJobs: parsedValue.failedJobs,
                lastFailure
            };
        } catch {
            return undefined;
        }
    }
};
