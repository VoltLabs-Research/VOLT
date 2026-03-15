import { useCallback, useEffect, useRef } from 'react';
import { sileo } from 'sileo';
import { JobStatus } from '../api/entities/job';
import type { Job } from '../api/entities/job';

interface UseJobsCompletionToastArgs {
    trajectoryId?: string;
    jobs: Job[];
    hasActiveJobs: boolean;
    allJobsCompleted: boolean;
};

const ANALYSIS_QUEUE_TYPE = 'analysis_processing';
const RASTER_QUEUE_TYPE = 'trajectory_rasterization';

const getCompletionToastTitle = (queueTypes: string[], allJobsCompleted: boolean): string => {
    const hasAnalysisJobs = queueTypes.includes(ANALYSIS_QUEUE_TYPE);
    const hasRasterJobs = queueTypes.includes(RASTER_QUEUE_TYPE);

    if (!allJobsCompleted) {
        if (hasRasterJobs && !hasAnalysisJobs) {
            return 'Rasterization completed with errors';
        }

        if (hasAnalysisJobs && !hasRasterJobs) {
            return 'Analysis completed with errors';
        }

        return 'Jobs completed with errors';
    }

    if (hasRasterJobs && !hasAnalysisJobs) {
        return 'Rasterization completed successfully';
    }

    if (hasAnalysisJobs && !hasRasterJobs) {
        return 'Analysis completed successfully!';
    }

    return 'Jobs completed successfully';
};

const useJobsCompletionToast = ({
    trajectoryId,
    jobs,
    hasActiveJobs,
    allJobsCompleted
}: UseJobsCompletionToastArgs) => {
    const hadActiveJobsRef = useRef(false);
    const hasShownCompletionToastRef = useRef(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeQueueTypesRef = useRef<string[]>([]);

    const clearCompletionTimer = useCallback(() => {
        if (!timerRef.current) return;
        clearTimeout(timerRef.current);
        timerRef.current = null;
    }, []);

    useEffect(() => {
        clearCompletionTimer();
        hadActiveJobsRef.current = false;
        hasShownCompletionToastRef.current = false;
        activeQueueTypesRef.current = [];
    }, [trajectoryId, clearCompletionTimer]);

    useEffect(() => {
        if (!hasActiveJobs) return;

        activeQueueTypesRef.current = Array.from(new Set(
            jobs
                .filter((job) => job.status !== JobStatus.Completed && job.status !== JobStatus.Failed)
                .map((job) => job.queueType)
                .filter((queueType): queueType is string => typeof queueType === 'string' && queueType.length > 0)
        ));
        hadActiveJobsRef.current = true;
        hasShownCompletionToastRef.current = false;
    }, [hasActiveJobs, jobs]);

    useEffect(() => {
        if (!trajectoryId) return;
        if (!hadActiveJobsRef.current) return;
        if (hasShownCompletionToastRef.current) return;
        if (hasActiveJobs) return;

        if (!allJobsCompleted) {
            clearCompletionTimer();
            timerRef.current = setTimeout(() => {
                sileo.warning({
                    title: getCompletionToastTitle(activeQueueTypesRef.current, false)
                });
                hasShownCompletionToastRef.current = true;
                hadActiveJobsRef.current = false;
                activeQueueTypesRef.current = [];
            }, 500);
            return clearCompletionTimer;
        }

        timerRef.current = setTimeout(() => {
            sileo.success({
                title: getCompletionToastTitle(activeQueueTypesRef.current, true)
            });
            hasShownCompletionToastRef.current = true;
            hadActiveJobsRef.current = false;
            activeQueueTypesRef.current = [];
        }, 500);

        return clearCompletionTimer;
    }, [trajectoryId, hasActiveJobs, allJobsCompleted, clearCompletionTimer]);
};

export default useJobsCompletionToast;
