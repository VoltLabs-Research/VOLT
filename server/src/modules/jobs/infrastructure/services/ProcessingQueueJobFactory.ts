import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { ProcessingQueueSessionRecord, hasJobProps } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';

export default class ProcessingQueueJobFactory {
    constructor(private readonly queueName: string) {}

    createSessionData(sessionId: string, jobs: Job[], sessionStartTime: Date): ProcessingQueueSessionRecord {
        const firstJob = jobs[0];

        if (!hasJobProps(firstJob)) {
            throw new Error(`[${this.queueName}] Invalid job payload while creating session data`);
        }

        return {
            sessionId,
            startTime: sessionStartTime,
            totalJobs: jobs.length,
            metadata: isRecord(firstJob.props.metadata) ? { ...firstJob.props.metadata } : {},
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

            return Job.create({
                jobId: jobData.jobId,
                teamId: jobData.teamId,
                queueType: jobData.queueType || this.queueName,
                status: JobStatus.Queued,
                sessionId,
                message: jobData.message,
                progress: resetProgress ? 0 : (jobData.progress || 0),
                metadata: isRecord(jobData.metadata) ? { ...jobData.metadata } : {},
                createdAt: resetProgress ? sessionTime : (jobData.createdAt || sessionTime),
                updatedAt: sessionTime
            });
        });
    }
}
