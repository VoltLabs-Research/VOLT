import { useCallback, useEffect, useRef } from 'react';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import type { Job } from '@/modules/jobs/domain/entities/Job';

interface UseJobsAutoSelectAnalysisArgs {
    trajectoryId?: string;
    jobs: Job[];
    updateSearchParams: (updates: Record<string, string | number | boolean | null | undefined>, options?: { replace?: boolean }) => void;
    setCurrentTimestep: (timestep: number) => void;
    refetchTrajectory: () => Promise<unknown>;
}

const getAnalysisIdFromJob = (job: Job): string | undefined => {
    if (job.analysisId) return job.analysisId;
    if (!job.jobId || !job.jobId.includes('-')) return undefined;

    const parts = job.jobId.split('-');
    parts.pop();
    return parts.join('-');
};

const useJobsAutoSelectAnalysis = ({
    trajectoryId,
    jobs,
    updateSearchParams,
    setCurrentTimestep,
    refetchTrajectory
}: UseJobsAutoSelectAnalysisArgs) => {
    const trackedJobIdsRef = useRef<Set<string>>(new Set());
    const hasAutoSelectedRef = useRef(false);

    const resetTracking = useCallback(() => {
        hasAutoSelectedRef.current = false;
        trackedJobIdsRef.current = new Set();
    }, []);

    const trackActiveJobs = useCallback(() => {
        if (!trajectoryId) return;

        for (const job of jobs) {
            if (job.status !== 'completed' && job.status !== 'failed' && job.jobId) {
                trackedJobIdsRef.current.add(job.jobId);
            }
        }
    }, [jobs, trajectoryId]);

    const attemptAutoSelect = useCallback(async () => {
        if (!trajectoryId || hasAutoSelectedRef.current) return;

        for (const job of jobs) {
            const isTracked = job.jobId && trackedJobIdsRef.current.has(job.jobId);
            const analysisId = getAnalysisIdFromJob(job);

            if (job.status === 'completed' && isTracked && analysisId) {
                hasAutoSelectedRef.current = true;
                try {
                    await refetchTrajectory();
                    const updatedTrajectory = useTrajectoryStore.getState().trajectory;
                    const analysisList = updatedTrajectory?.analysis || [];
                    const analysis = analysisList.find((item: any) => item._id === analysisId);
                    if (analysis) {
                        updateSearchParams({ analysis: analysis._id }, { replace: true });
                        if (job.timestep !== undefined) setCurrentTimestep(job.timestep);
                    }
                } catch (error) {
                    console.error('[JobsHistoryViewer] Failed to auto-select analysis:', error);
                }
                break;
            }
        }
    }, [jobs, trajectoryId, refetchTrajectory, updateSearchParams, setCurrentTimestep]);

    useEffect(() => {
        trackActiveJobs();
    }, [trackActiveJobs]);

    useEffect(() => {
        void attemptAutoSelect();
    }, [attemptAutoSelect]);

    return { resetTracking };
};

export default useJobsAutoSelectAnalysis;
