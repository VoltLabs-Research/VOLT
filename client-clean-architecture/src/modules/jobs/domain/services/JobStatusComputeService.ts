/**
 * Job status values.
 */
export type JobStatus = 'running' | 'queued' | 'retrying' | 'failed' | 'completed';

/**
 * Frame job group status values.
 */
export type FrameJobGroupStatus = 'running' | 'queued' | 'completed' | 'failed' | 'partial';

/**
 * Job reference for status computation.
 */
export interface JobRef {
    status: JobStatus;
}

/**
 * Service for computing job status.
 * Pure domain logic - no external dependencies.
 */
export class JobStatusComputeService {
    /**
     * Computes the overall status for a group of jobs.
     * Pure function - deterministic output for any input.
     *
     * @param jobs - Array of jobs with status
     * @returns Computed overall status
     */
    computeStatus(jobs: JobRef[]): FrameJobGroupStatus {
        if (jobs.length === 0) return 'completed';

        const hasRunning = jobs.some(j => j.status === 'running');
        const hasQueued = jobs.some(j => j.status === 'queued' || j.status === 'retrying');
        const hasFailed = jobs.some(j => j.status === 'failed');
        const allCompleted = jobs.every(j => j.status === 'completed');

        if (hasRunning) return 'running';
        if (hasQueued) return 'queued';
        if (allCompleted) return 'completed';
        if (hasFailed && jobs.filter(j => j.status === 'completed').length === 0) return 'failed';

        return 'partial';
    }

    /**
     * Counts completed jobs.
     */
    countCompleted(jobs: JobRef[]): number {
        return jobs.filter(j => j.status === 'completed').length;
    }

    /**
     * Counts failed jobs.
     */
    countFailed(jobs: JobRef[]): number {
        return jobs.filter(j => j.status === 'failed').length;
    }

    /**
     * Counts running jobs.
     */
    countRunning(jobs: JobRef[]): number {
        return jobs.filter(j => j.status === 'running').length;
    }

    /**
     * Computes progress percentage.
     */
    computeProgress(jobs: JobRef[]): number {
        if (jobs.length === 0) return 100;
        const completed = this.countCompleted(jobs);
        return Math.round((completed / jobs.length) * 100);
    }

    /**
     * Checks if all jobs are done (completed or failed).
     */
    isAllDone(jobs: JobRef[]): boolean {
        return jobs.every(j => j.status === 'completed' || j.status === 'failed');
    }
}
