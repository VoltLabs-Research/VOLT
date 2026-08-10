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

/*
 * The canvas used to declare its own `isQueuedJobStatus` / `isRunningJobStatus` that
 * disagreed with the jobs module about `Retrying`. They are re-exported here rather
 * than redeclared so the canvas keeps its import path and there is still only one
 * definition.
 */
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

/*
 * A job aggregate and an analysis answer the same question in two vocabularies, so
 * this is a translation of `computeGroupStatus` rather than a second implementation
 * of it. `Partial` — some completed, some failed, nothing pending — has no analysis
 * equivalent, and returning `undefined` for it lets the persisted row decide.
 */
const ANALYSIS_STATUS_BY_GROUP_STATUS: Record<FrameJobGroupStatus, AnalysisStatus | undefined> = {
    [FrameJobGroupStatus.Running]: AnalysisStatus.Running,
    [FrameJobGroupStatus.Queued]: AnalysisStatus.Pending,
    [FrameJobGroupStatus.Completed]: AnalysisStatus.Completed,
    [FrameJobGroupStatus.Failed]: AnalysisStatus.Failed,
    [FrameJobGroupStatus.Partial]: undefined
};

export const deriveAnalysisStatusFromJobs = (jobs: Job[]): AnalysisStatus | undefined => {
    /* An empty set says nothing; `computeGroupStatus` would call it completed. */
    if (jobs.length === 0) return undefined;

    return ANALYSIS_STATUS_BY_GROUP_STATUS[computeGroupStatus(jobs)];
};
