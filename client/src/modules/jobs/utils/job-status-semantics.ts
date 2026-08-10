import { FrameJobGroupStatus, JobStatus } from '@volt/contracts/modules/jobs/domain';

import type { Job } from '@volt/contracts/modules/jobs/domain';

/*
 * How a job's status is bucketed, in one place.
 *
 * These used to be declared twice with different answers: `computeGroupStatus`
 * counted `Retrying` as queued while the canvas' `isRunningJobStatus` counted it as
 * running, so the same job read as two colours depending on which view you looked
 * at. `computeGroupStatus` below is built *from* these predicates rather than
 * repeating their conditions, which is what keeps the two from drifting again.
 *
 * A retry is queued, not running: the attempt that was running has already ended,
 * and the job is waiting for a worker to pick it up again.
 */
export const isRunningJobStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Running;
};

export const isQueuedJobStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Queued
        || status === JobStatus.Retrying
        || status === JobStatus.QueuedAfterFailure;
};

export const isCompletedJobStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Completed;
};

export const isFailedJobStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Failed;
};

/**
 * The status of a set of jobs taken together — a frame, or a whole trajectory.
 *
 * Ordering is deliberate: any live work outranks any finished work, so a frame with
 * one running job reads as running no matter how much of it already completed.
 * `Partial` is the mixed leftover — some completed, some failed, nothing pending.
 *
 * Mirrors `computeFrameStatus` in the server's `TeamJobsService`, which computes the
 * same field before it is sent. Change one and the other has to follow.
 */
export const computeGroupStatus = (jobs: Job[]): FrameJobGroupStatus => {
    const hasRunning = jobs.some((job) => isRunningJobStatus(job.status));
    const hasQueued = jobs.some((job) => isQueuedJobStatus(job.status));
    const hasFailed = jobs.some((job) => isFailedJobStatus(job.status));
    const hasCompleted = jobs.some((job) => isCompletedJobStatus(job.status));
    const allCompleted = jobs.every((job) => isCompletedJobStatus(job.status));

    if (hasRunning) return FrameJobGroupStatus.Running;
    if (hasQueued) return FrameJobGroupStatus.Queued;
    if (allCompleted) return FrameJobGroupStatus.Completed;
    if (hasFailed && !hasCompleted) return FrameJobGroupStatus.Failed;
    return FrameJobGroupStatus.Partial;
};
