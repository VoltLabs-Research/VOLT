import IORedis from 'ioredis';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import {
    JOB_STATUS_KEY_PREFIX,
    QueueJobData,
    QueueStatusProjectionResult,
    STATUS_TTL_SECONDS
} from '@modules/jobs/infrastructure/services/ProcessingQueueShared';

export default class ProcessingQueueStatusProjectionService {
    constructor(
        private readonly redis: IORedis,
        private readonly queueName: string
    ) {}

    private statusKey(jobId: string): string {
        return `${JOB_STATUS_KEY_PREFIX}${jobId}`;
    }

    async project(jobId: string, status: JobStatus, data: QueueJobData): Promise<QueueStatusProjectionResult> {
        const statusData = {
            ...data,
            ...(isRecord(data.metadata) ? data.metadata : {}),
            jobId,
            status,
            timestamp: new Date().toISOString(),
            queueType: this.queueName
        };

        const teamId = typeof data.teamId === 'string' ? data.teamId : undefined;
        const pipeline = this.redis.pipeline();

        pipeline.set(this.statusKey(jobId), JSON.stringify(statusData), 'EX', STATUS_TTL_SECONDS);
        if (teamId) {
            pipeline.sadd(`team:${teamId}:jobs`, jobId);
        }

        await pipeline.exec();

        return {
            statusData,
            teamId
        };
    }

    async getJobStatus(jobId: string): Promise<Record<string, unknown> | null> {
        const data = await this.redis.get(this.statusKey(jobId));
        if (!data) {
            return null;
        }

        try {
            return JSON.parse(data) as Record<string, unknown>;
        } catch {
            return null;
        }
    }
}
