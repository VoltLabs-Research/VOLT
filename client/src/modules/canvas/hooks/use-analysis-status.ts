import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { JobStatus } from '@/modules/jobs/api/entities/job';
import { useCallback, useMemo } from 'react';
import { AnalysisStatus, isCanvasAnalysisInProgress } from '../utilities/analysis-status';

import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { Job } from '@/modules/jobs/api/entities/job';
import type { CanvasAnalysisStatusEntry } from '../utilities/analysis-status';

interface UseAnalysisStatusProps {
    trajectoryId?: string;
    enabled?: boolean;
};

const resolveAnalysisId = (job: Job): string | undefined => {
    if (typeof job.analysisId === 'string' && job.analysisId.trim().length > 0) {
        return job.analysisId;
    }

    if (typeof job.metadata?.analysisId === 'string' && job.metadata.analysisId.trim().length > 0) {
        return job.metadata.analysisId;
    }

    return undefined;
};

const deriveAnalysisStatusFromJobs = (jobs: Job[]): AnalysisStatus | undefined => {
    if (jobs.length === 0) return undefined;

    if (jobs.some((job) => job.status === JobStatus.Running || job.status === JobStatus.Retrying)) {
        return AnalysisStatus.Running;
    }

    if (jobs.some((job) => job.status === JobStatus.Queued || job.status === JobStatus.QueuedAfterFailure)) {
        return AnalysisStatus.Pending;
    }

    const allCompleted = jobs.every((job) => job.status === JobStatus.Completed);
    if (allCompleted) {
        return AnalysisStatus.Completed;
    }

    const anyFailed = jobs.some((job) => job.status === JobStatus.Failed);
    const anyCompleted = jobs.some((job) => job.status === JobStatus.Completed);
    if (anyFailed && !anyCompleted) {
        return AnalysisStatus.Failed;
    }

    return undefined;
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
                    const analysisId = resolveAnalysisId(job);
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
            const jobs = jobsByAnalysisId.get(analysis._id) ?? [];
            const derived = deriveAnalysisStatusFromJobs(jobs);

            next.set(analysis._id, {
                status: derived ?? (analysis.status as AnalysisStatus),
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
