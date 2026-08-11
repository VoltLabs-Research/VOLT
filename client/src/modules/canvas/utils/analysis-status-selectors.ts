import { FrameJobGroupStatus } from '@volt/contracts/modules/jobs/domain';
import {
    computeGroupStatus,
    isCompletedJobStatus,
    isFailedJobStatus,
    isQueuedJobStatus,
    isRunningJobStatus
} from '@/modules/jobs/utils/job-status-semantics';
import { deriveAnalysisStatusFromJobs, resolveJobAnalysisId } from './analysis-job-status';
import { AnalysisStatus, normalizeCanvasAnalysisStatus } from './analysis-status';

import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { Job, TrajectoryJobGroup } from '@volt/contracts/modules/jobs/domain';
import type { CanvasAnalysisStatus, CanvasAnalysisStatusEntry } from './analysis-status';

/*
 * Every derivation of "what is this analysis doing right now" lives here, as pure
 * functions over the two inputs that can answer it: the persisted analysis rows and
 * the live jobs feed.
 *
 * There used to be five of these scattered across hooks and components, and they
 * disagreed — one merged the two sources forward-only, one let the jobs win, one read
 * only the jobs, one read only the row. The same analysis could render as queued in
 * the timeline and running in the tree at the same time. Keeping the derivations
 * pure and in one file is what makes that contradiction impossible to reintroduce
 * quietly: a new rule has to be added next to the ones it would contradict.
 */

/*
 * Artifact uploads trail the compute they belong to, so counting them would report an
 * analysis as busy for as long as its results are still being stored.
 *
 * Every analysis-scoped derivation below excludes them — the analysis' own status and
 * its per-frame status alike, so those two can never disagree. The unscoped frame
 * aggregate keeps them, because "is anything happening on this frame" is a different
 * question from "how far along is this analysis".
 */
const ARTIFACT_UPLOAD_QUEUE_TYPE = 'artifact_upload';

export type TimelineTickTone = 'queued' | 'running' | 'completed';
export type AnalysisActivityTone = TimelineTickTone | 'failed';

export interface JobStatusCounts {
    queued: number;
    running: number;
    completed: number;
    failed: number;
}

interface FrameStatusIndex {
    /** Status of each frame taken as a whole, across every analysis on it. */
    aggregateByTimestep: Map<number, FrameJobGroupStatus>;
    /** Status of one analysis on one frame, which is what the ruler colours. */
    byTimestepAndAnalysis: Map<number, Map<string, FrameJobGroupStatus>>;
}

/**
 * Walks frames, optionally narrowed to one trajectory.
 *
 * The `groups -> frameGroups -> jobs` descent was written out five times; every
 * selector below goes through this instead. An omitted `trajectoryId` means every
 * trajectory — the dashboard counts jobs team-wide, with no canvas open.
 */
const forEachFrame = (
    groups: readonly TrajectoryJobGroup[],
    trajectoryId: string | undefined,
    visit: (timestep: number, jobs: Job[], overallStatus: FrameJobGroupStatus) => void
): void => {
    for (const group of groups) {
        if (trajectoryId && group.trajectoryId !== trajectoryId) continue;

        for (const frameGroup of group.frameGroups) {
            visit(frameGroup.timestep, frameGroup.jobs, frameGroup.overallStatus);
        }
    }
};

export const buildJobsByAnalysisId = (
    groups: readonly TrajectoryJobGroup[],
    trajectoryId: string | undefined
): Map<string, Job[]> => {
    const jobsByAnalysisId = new Map<string, Job[]>();

    /* Analysis scoping is meaningless without a trajectory to scope to. */
    if (!trajectoryId) return jobsByAnalysisId;

    forEachFrame(groups, trajectoryId, (_timestep, jobs) => {
        for (const job of jobs) {
            const analysisId = resolveJobAnalysisId(job);
            if (!analysisId) continue;

            const bucket = jobsByAnalysisId.get(analysisId);
            if (bucket) bucket.push(job);
            else jobsByAnalysisId.set(analysisId, [job]);
        }
    });

    return jobsByAnalysisId;
};

const isTerminalAnalysisStatus = (status?: string): boolean => {
    return status === AnalysisStatus.Completed || status === AnalysisStatus.Failed;
};

/*
 * An analysis only ever moves forward, so a status is comparable by how far along it
 * is. Ranking them lets the two sources be merged without either one dragging the
 * other backwards.
 */
const STATUS_RANK: Record<string, number> = {
    [AnalysisStatus.Pending]: 0,
    [AnalysisStatus.Running]: 1,
    [AnalysisStatus.Failed]: 2,
    [AnalysisStatus.Completed]: 2
};

/**
 * Merges the analysis row's status with the one implied by its jobs.
 *
 * The row is what the server computed from the whole job session, and the jobs are a
 * live but partial view: the job-derived status reports `Pending` as soon as any job
 * is queued, which for a multi-frame run is true for almost the entire run. Letting
 * that win is what showed a running analysis as queued while its artifacts were
 * visibly uploading. The job view is still worth having — it promotes an analysis
 * whose row has not caught up yet — so it may only move the status forward.
 */
const mergeAnalysisStatus = (
    persisted: CanvasAnalysisStatus,
    derived?: CanvasAnalysisStatus
): CanvasAnalysisStatus => {
    if (isTerminalAnalysisStatus(persisted)) return persisted;
    if (!derived) return persisted;

    const persistedRank = STATUS_RANK[persisted] ?? 0;
    const derivedRank = STATUS_RANK[derived] ?? 0;
    return derivedRank > persistedRank ? derived : persisted;
};

export const buildAnalysisStatusMap = (
    analyses: readonly Analysis[],
    jobsByAnalysisId: Map<string, Job[]>,
    trajectoryId: string | undefined
): Map<string, CanvasAnalysisStatusEntry> => {
    const statusMap = new Map<string, CanvasAnalysisStatusEntry>();

    for (const analysis of analyses) {
        const persisted = normalizeCanvasAnalysisStatus(analysis.status) ?? AnalysisStatus.Pending;
        const jobs = (jobsByAnalysisId.get(analysis._id) ?? [])
            .filter((job) => job.queueType !== ARTIFACT_UPLOAD_QUEUE_TYPE);

        statusMap.set(analysis._id, {
            status: mergeAnalysisStatus(persisted, deriveAnalysisStatusFromJobs(jobs)),
            trajectoryId: analysis.trajectory?._id ?? trajectoryId
        });
    }

    return statusMap;
};

export const buildFrameStatusIndex = (
    groups: readonly TrajectoryJobGroup[],
    trajectoryId: string | undefined
): FrameStatusIndex => {
    const aggregateByTimestep = new Map<number, FrameJobGroupStatus>();
    const byTimestepAndAnalysis = new Map<number, Map<string, FrameJobGroupStatus>>();

    /* Timesteps only line up within a single trajectory. */
    if (!trajectoryId) return { aggregateByTimestep, byTimestepAndAnalysis };

    forEachFrame(groups, trajectoryId, (timestep, jobs, overallStatus) => {
        /*
         * The server already computed this for the frame, so recomputing it here would
         * be a fourth opinion on the same question.
         */
        aggregateByTimestep.set(timestep, overallStatus);

        const jobsByAnalysis = new Map<string, Job[]>();
        for (const job of jobs) {
            const analysisId = resolveJobAnalysisId(job);
            if (!analysisId) continue;

            /*
             * Same exclusion as `buildAnalysisStatusMap`. Without it a frame whose
             * compute had finished but whose upload was still queued turned the tick
             * orange while the tree row for that very analysis read as running — the
             * contradiction this module exists to remove, reintroduced one level down.
             * The unscoped aggregate above keeps uploads, because "is anything happening
             * on this frame" is a different question from "how far is this analysis".
             */
            if (job.queueType === ARTIFACT_UPLOAD_QUEUE_TYPE) continue;

            const bucket = jobsByAnalysis.get(analysisId);
            if (bucket) bucket.push(job);
            else jobsByAnalysis.set(analysisId, [job]);
        }

        if (jobsByAnalysis.size === 0) return;

        const perAnalysis = byTimestepAndAnalysis.get(timestep) ?? new Map<string, FrameJobGroupStatus>();
        for (const [analysisId, analysisJobs] of jobsByAnalysis) {
            /*
             * The same function the server and the optimistic patches use, so a frame
             * scoped to one analysis is bucketed exactly like the frame as a whole.
             */
            perAnalysis.set(analysisId, computeGroupStatus(analysisJobs));
        }
        byTimestepAndAnalysis.set(timestep, perAnalysis);
    });

    return {
        aggregateByTimestep,
        byTimestepAndAnalysis
    };
};

/**
 * The tick tone for a frame's job status.
 *
 * `failed` and `partial` map to no tone on purpose: the ruler only has CSS for the
 * three tones below, and a frame that has finished — successfully or not — is not
 * live work. A recently-finished frame still gets its ephemeral `completed` flash from
 * the timeline hook, layered on top of this.
 */
export const toTimelineTickTone = (status?: FrameJobGroupStatus): TimelineTickTone | undefined => {
    if (status === FrameJobGroupStatus.Running) return 'running';
    if (status === FrameJobGroupStatus.Queued) return 'queued';
    return undefined;
};

/**
 * Frame status as the log panel labels activity.
 *
 * `Partial` becomes `failed`: it means the frame finished with at least one failure
 * alongside its completions, and the previous per-frame derivation reported exactly
 * that by testing for failures before completions. There is no mixed label to show.
 */
export const toAnalysisFrameActivityStatus = (
    status?: FrameJobGroupStatus
): 'queued' | 'running' | 'completed' | 'failed' | undefined => {
    switch (status) {
        case FrameJobGroupStatus.Running: return 'running';
        case FrameJobGroupStatus.Queued: return 'queued';
        case FrameJobGroupStatus.Completed: return 'completed';
        case FrameJobGroupStatus.Failed: return 'failed';
        case FrameJobGroupStatus.Partial: return 'failed';
        default: return undefined;
    }
};

export const buildJobStatusCounts = (
    groups: readonly TrajectoryJobGroup[],
    trajectoryId: string | undefined
): JobStatusCounts => {
    const counts: JobStatusCounts = { queued: 0, running: 0, completed: 0, failed: 0 };

    forEachFrame(groups, trajectoryId, (_timestep, jobs) => {
        for (const job of jobs) {
            if (isRunningJobStatus(job.status)) counts.running += 1;
            else if (isQueuedJobStatus(job.status)) counts.queued += 1;
            else if (isCompletedJobStatus(job.status)) counts.completed += 1;
            else if (isFailedJobStatus(job.status)) counts.failed += 1;
        }
    });

    return counts;
};

