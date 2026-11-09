import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import type { Job, TrajectoryJobGroup } from '@volt/contracts/modules/jobs/domain';

export interface ReportedJobProgress {
    // 0..1; absent while the plugin has only said what it is doing.
    value?: number;
    text?: string;
}

const clampFraction = (value: number): number => Math.min(1, Math.max(0, value));

// What a running job's plugin last said about it; null when it said nothing or the job is not running.
export const readJobProgress = (job: Job): ReportedJobProgress | null => {
    if (job.status !== JobStatus.Running) return null;

    const value = typeof job.progress === 'number' && Number.isFinite(job.progress) ? clampFraction(job.progress) : undefined;
    const text = typeof job.progressText === 'string' && job.progressText.length > 0 ? job.progressText : undefined;
    if (value === undefined && text === undefined) return null;

    return {
        ...(value !== undefined ? { value } : {}),
        ...(text !== undefined ? { text } : {})
    };
};

// The share of their work the running jobs have reported done: a job that reported nothing adds nothing.
export const sumReportedProgress = (jobs: Iterable<Job>): number => {
    let total = 0;
    for (const job of jobs) {
        total += readJobProgress(job)?.value ?? 0;
    }
    return total;
};

export const formatProgressPercent = (fraction: number): string => `${Math.floor(clampFraction(fraction) * 100)}%`;

export interface AnalysisRunProgress {
    // Frames that are done, whether they completed or failed.
    finishedFrames: number;
    totalFrames: number;
    // 0..1: finished frames whole, running ones by what their plugin reported.
    fraction: number;
    runningFrames: number;
    // Whether a running frame's plugin has given a value yet; until then the fraction only counts finished frames.
    reported: boolean;
    // What a running frame's plugin is doing, when one said.
    text?: string;
}

const isFinishedJob = (job: Job): boolean => job.status === JobStatus.Completed || job.status === JobStatus.Failed;

// How far an analysis run is, from the jobs of its frames; null when none of them is known here.
export const computeAnalysisRunProgress = (
    groups: readonly TrajectoryJobGroup[],
    analysisId: string,
    totalFrames?: number
): AnalysisRunProgress | null => {
    const jobs: Job[] = [];
    for (const group of groups) {
        for (const frame of group.frameGroups) {
            for (const job of frame.jobs) {
                if (job.analysisId === analysisId) jobs.push(job);
            }
        }
    }
    if (jobs.length === 0) return null;

    const finishedFrames = jobs.filter(isFinishedJob).length;
    const runningJobs = jobs.filter((job) => job.status === JobStatus.Running);
    const total = Math.max(totalFrames || 0, jobs.length);
    const text = runningJobs.map((job) => readJobProgress(job)?.text).find((value) => value !== undefined);

    return {
        finishedFrames,
        totalFrames: total,
        fraction: clampFraction((finishedFrames + sumReportedProgress(runningJobs)) / total),
        runningFrames: runningJobs.length,
        reported: runningJobs.some((job) => readJobProgress(job)?.value !== undefined),
        ...(text !== undefined ? { text } : {})
    };
};
