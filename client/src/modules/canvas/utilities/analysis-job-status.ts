import { JobStatus } from '@/modules/jobs/api/entities/job';
import { AnalysisStatus } from './analysis-status';

import type { Job } from '@/modules/jobs/api/entities/job';

export const resolveJobAnalysisId = (job: Job): string | undefined => {
    if (typeof job.analysisId === 'string' && job.analysisId.trim().length > 0) {
        return job.analysisId;
    }

    if (typeof job.metadata?.analysisId === 'string' && job.metadata.analysisId.trim().length > 0) {
        return job.metadata.analysisId;
    }

    return undefined;
};

export const isQueuedJobStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Queued || status === JobStatus.QueuedAfterFailure;
};

export const isRunningJobStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Running || status === JobStatus.Retrying;
};

export const deriveAnalysisStatusFromJobs = (jobs: Job[]): AnalysisStatus | undefined => {
    if (jobs.length === 0) return undefined;

    if (jobs.some((job) => isRunningJobStatus(job.status))) {
        return AnalysisStatus.Running;
    }

    if (jobs.some((job) => isQueuedJobStatus(job.status))) {
        return AnalysisStatus.Pending;
    }

    if (jobs.every((job) => job.status === JobStatus.Completed)) {
        return AnalysisStatus.Completed;
    }

    const anyFailed = jobs.some((job) => job.status === JobStatus.Failed);
    const anyCompleted = jobs.some((job) => job.status === JobStatus.Completed);
    if (anyFailed && !anyCompleted) {
        return AnalysisStatus.Failed;
    }

    return undefined;
};
