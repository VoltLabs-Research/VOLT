import { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';
import {
    computeGroupStatus,
    isCompletedJobStatus,
    isFailedJobStatus,
    isQueuedJobStatus,
    isRunningJobStatus
} from '@/modules/jobs/utils/job-status-semantics';
import { AnalysisStatus } from './analysis-status';

import type { Job } from '@volt/contracts/modules/jobs/domain';

export {
    computeGroupStatus,
    isCompletedJobStatus,
    isFailedJobStatus,
    isQueuedJobStatus,
    isRunningJobStatus
};

export const resolveJobAnalysisId = (job: Job): string | undefined => {
    if (job.analysisId?.trim()) {
        return job.analysisId;
    }

    if (typeof job.metadata?.analysisId === 'string' && job.metadata.analysisId.trim().length > 0) {
        return job.metadata.analysisId;
    }

    return undefined;
};

const ANALYSIS_STATUS_BY_GROUP_STATUS: Record<FrameJobGroupStatus, AnalysisStatus | undefined> = {
    [FrameJobGroupStatus.Running]: AnalysisStatus.Running,
    [FrameJobGroupStatus.Queued]: AnalysisStatus.Pending,
    [FrameJobGroupStatus.Completed]: AnalysisStatus.Completed,
    [FrameJobGroupStatus.Failed]: AnalysisStatus.Failed,
    [FrameJobGroupStatus.Partial]: undefined
};

export const deriveAnalysisStatusFromJobs = (jobs: Job[]): AnalysisStatus | undefined => {
    if (jobs.length === 0) return undefined;

    return ANALYSIS_STATUS_BY_GROUP_STATUS[computeGroupStatus(jobs)];
};
