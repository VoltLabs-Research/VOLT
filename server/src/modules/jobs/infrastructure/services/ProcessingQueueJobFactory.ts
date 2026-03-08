import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { hasJobProps } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import Job from '@modules/jobs/domain/entities/Job';
import type { ProcessingQueueSessionRecord } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';

export default class ProcessingQueueJobFactory {
    constructor(private readonly queueName: string) {}

    createSessionData(sessionId: string, jobs: Job[], sessionStartTime: Date): ProcessingQueueSessionRecord {
        const firstJob = jobs[0];

        if (!hasJobProps(firstJob)) {
            throw new Error(`[${this.queueName}] Invalid job payload while creating session data`);
        }

        let metadata = {};
        if (isRecord(firstJob.props.metadata)) {
            metadata = { ...firstJob.props.metadata };
        }

        return {
            sessionId,
            startTime: sessionStartTime,
            totalJobs: jobs.length,
            metadata,
            teamId: firstJob.props.teamId,
            queueType: firstJob.props.queueType,
            status: 'active'
        };
    }

    buildSessionJobs<T extends Job>(jobs: T[], sessionId: string, sessionTime: Date, resetProgress: boolean): Job[] {
        return jobs.map((job) => {
            if (!hasJobProps(job)) {
                throw new Error(`[${this.queueName}] Invalid job payload received while building session jobs`);
            }

            const jobData = job.props;
            let progress = jobData.progress || 0;
            if (resetProgress) {
                progress = 0;
            }

            let metadata = {};
            if (isRecord(jobData.metadata)) {
                metadata = { ...jobData.metadata };
            }

            let createdAt = jobData.createdAt || sessionTime;
            if (resetProgress) {
                createdAt = sessionTime;
            }

            return Job.create({
                jobId: jobData.jobId,
                teamId: jobData.teamId,
                queueType: jobData.queueType || this.queueName,
                status: JobStatus.Queued,
                sessionId,
                message: jobData.message,
                progress,
                metadata,
                createdAt,
                updatedAt: sessionTime
            });
        });
    }
};
