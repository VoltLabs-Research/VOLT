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
    aggregateByTimestep: Map<number, FrameJobGroupStatus>;

    byTimestepAndAnalysis: Map<number, Map<string, FrameJobGroupStatus>>;
}

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

const STATUS_RANK: Record<string, number> = {
    [AnalysisStatus.Pending]: 0,
    [AnalysisStatus.Running]: 1,
    [AnalysisStatus.Failed]: 2,
    [AnalysisStatus.Completed]: 2
};

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

    if (!trajectoryId) return { aggregateByTimestep, byTimestepAndAnalysis };

    forEachFrame(groups, trajectoryId, (timestep, jobs, overallStatus) => {
        aggregateByTimestep.set(timestep, overallStatus);

        const jobsByAnalysis = new Map<string, Job[]>();
        for (const job of jobs) {
            const analysisId = resolveJobAnalysisId(job);
            if (!analysisId) continue;

            if (job.queueType === ARTIFACT_UPLOAD_QUEUE_TYPE) continue;

            const bucket = jobsByAnalysis.get(analysisId);
            if (bucket) bucket.push(job);
            else jobsByAnalysis.set(analysisId, [job]);
        }

        if (jobsByAnalysis.size === 0) return;

        const perAnalysis = byTimestepAndAnalysis.get(timestep) ?? new Map<string, FrameJobGroupStatus>();
        for (const [analysisId, analysisJobs] of jobsByAnalysis) {
            perAnalysis.set(analysisId, computeGroupStatus(analysisJobs));
        }
        byTimestepAndAnalysis.set(timestep, perAnalysis);
    });

    return {
        aggregateByTimestep,
        byTimestepAndAnalysis
    };
};

export const toTimelineTickTone = (status?: FrameJobGroupStatus): TimelineTickTone | undefined => {
    if (status === FrameJobGroupStatus.Running) return 'running';
    if (status === FrameJobGroupStatus.Queued) return 'queued';
    return undefined;
};

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

export const computeRunActivityStatus = (
    statuses: readonly (CanvasAnalysisStatus | undefined)[]
): CanvasAnalysisStatus | undefined => {
    const known = statuses.filter((status): status is CanvasAnalysisStatus => status !== undefined);
    if (known.length === 0) return undefined;

    if (known.some((status) => status === AnalysisStatus.Running)) return AnalysisStatus.Running;
    if (known.some((status) => status === AnalysisStatus.Pending)) return AnalysisStatus.Pending;
    if (known.every((status) => status === AnalysisStatus.Completed)) return AnalysisStatus.Completed;
    return AnalysisStatus.Failed;
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
