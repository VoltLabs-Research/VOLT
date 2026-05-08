import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { deriveAnalysisStatusFromJobs, resolveJobAnalysisId } from '../utilities/analysis-job-status';
import { useCallback, useMemo } from 'react';
import { AnalysisStatus, isCanvasAnalysisInProgress } from '../utilities/analysis-status';

import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { Job } from '@/modules/jobs/api/entities/job';
import type { CanvasAnalysisStatusEntry } from '../utilities/analysis-status';

interface UseAnalysisStatusProps {
    trajectoryId?: string;
    enabled?: boolean;
}

const ARTIFACT_UPLOAD_QUEUE_TYPE = 'artifact_upload';

const isTerminalAnalysisStatus = (status?: string): boolean => {
    return status === AnalysisStatus.Completed || status === AnalysisStatus.Failed;
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
                status: isTerminalAnalysisStatus(persistedStatus) ? persistedStatus : (derived ?? persistedStatus),
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
