import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { deriveAnalysisStatusFromJobs, resolveJobAnalysisId } from '../utils/analysis-job-status';
import { useCallback, useMemo } from 'react';
import { AnalysisStatus, isCanvasAnalysisInProgress } from '../utils/analysis-status';

import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { Job } from '@volt/contracts/modules/jobs/domain';
import type { CanvasAnalysisStatusEntry } from '../utils/analysis-status';

interface UseAnalysisStatusProps {
    trajectoryId?: string;
    enabled?: boolean;
}

const ARTIFACT_UPLOAD_QUEUE_TYPE = 'artifact_upload';

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
 * live but partial view: `deriveAnalysisStatusFromJobs` reports `Pending` as soon as
 * *any* job is queued, which for a multi-frame run is true for almost the entire run.
 * Letting that win is what showed a running analysis as queued while its artifacts
 * were visibly uploading. The job view is still worth having — it promotes an
 * analysis whose row has not caught up yet — so it may only move the status forward.
 */
const mergeAnalysisStatus = (
    persisted: AnalysisStatus,
    derived?: AnalysisStatus
): AnalysisStatus => {
    if (isTerminalAnalysisStatus(persisted)) return persisted;
    if (!derived) return persisted;

    const persistedRank = STATUS_RANK[persisted] ?? 0;
    const derivedRank = STATUS_RANK[derived] ?? 0;
    return derivedRank > persistedRank ? derived : persisted;
};

const useAnalysisStatus = ({ trajectoryId, enabled = true }: UseAnalysisStatusProps) => {
    const analysesQuery = useAnalysesByTrajectoryQuery(
        {
            trajectoryId: trajectoryId ?? '',
            page: 1,
            limit: 100
        },
        { enabled: enabled && !!trajectoryId }
    );
    const analyses = ((analysesQuery.data as { data?: Analysis[] } | undefined)?.data ?? []);

    const { data: groups = [] } = teamJobsGroups();

    const jobsByAnalysisId = useMemo(() => {
        const next = new Map<string, Job[]>();
        if (!trajectoryId) return next;

        for (const group of groups) {
            if (group.trajectoryId !== trajectoryId) continue;

            for (const frameGroup of group.frameGroups) {
                for (const job of frameGroup.jobs) {
                    const analysisId = resolveJobAnalysisId(job);
                    if (!analysisId) continue;

                    const bucket = next.get(analysisId);
                    if (bucket) bucket.push(job);
                    else next.set(analysisId, [job]);
                }
            }
        }

        return next;
    }, [groups, trajectoryId]);

    const statusMap = useMemo(() => {
        const next = new Map<string, CanvasAnalysisStatusEntry>();

        for (const analysis of analyses) {
            const persistedStatus = analysis.status as AnalysisStatus;
            const jobs = (jobsByAnalysisId.get(analysis._id) ?? [])
                .filter((job) => job.queueType !== ARTIFACT_UPLOAD_QUEUE_TYPE);
            const derived = deriveAnalysisStatusFromJobs(jobs);

            next.set(analysis._id, {
                status: mergeAnalysisStatus(persistedStatus, derived),
                trajectoryId: analysis.trajectory?._id ?? trajectoryId
            });
        }

        return next;
    }, [analyses, jobsByAnalysisId, trajectoryId]);

    const getAnalysisStatus = useCallback((analysisId: string): AnalysisStatus | undefined => {
        return statusMap.get(analysisId)?.status;
    }, [statusMap]);

    const isAnalysisInProgress = useCallback((analysisId: string): boolean => {
        return isCanvasAnalysisInProgress(statusMap.get(analysisId)?.status);
    }, [statusMap]);

    return {
        statusMap,
        getAnalysisStatus,
        isAnalysisInProgress
    };
};

export default useAnalysisStatus;
