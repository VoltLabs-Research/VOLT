import { JobStatus } from '../api/entities/job';
import useCanvasUrlState from '@/modules/canvas/hooks/use-canvas-url-state';
import useGetTrajectoryById from '@/modules/trajectory/hooks/trajectory/use-get-trajectory-by-id';
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import type { Job } from '../api/entities/job';

interface UseJobsAutoSelectAnalysisArgs {
    enabled?: boolean;
    trajectoryId?: string;
    jobs: Job[];
    setCurrentTimestep: (timestep: number) => void;
};

interface PendingSelection {
    analysisId: string;
    timestep?: number;
};

const ANALYSIS_QUEUE_TYPE = 'analysis_processing';

const getAnalysisIdFromJob = (job: Job): string | undefined => {
    if (job.queueType !== ANALYSIS_QUEUE_TYPE) {
        return undefined;
    }

    if (job.analysisId) return job.analysisId;
    if (typeof job.metadata?.analysisId === 'string') return job.metadata.analysisId;
    if (!job.jobId || !job.jobId.includes('-')) return undefined;

    const parts = job.jobId.split('-');
    parts.pop();
    return parts.join('-');
};

const useJobsAutoSelectAnalysis = ({
    enabled = true,
    trajectoryId,
    jobs,
    setCurrentTimestep
}: UseJobsAutoSelectAnalysisArgs) => {
    const trackedJobIdsRef = useRef<Set<string>>(new Set());
    const hasAutoSelectedRef = useRef(false);
    const pendingSelectionRef = useRef<PendingSelection | null>(null);
    const refreshInFlightRef = useRef(false);
    const location = useLocation();
    const { trajectory, refetch: refetchTrajectory } = useGetTrajectoryById({ trajectoryId, enabled: false });
    const { setAnalysisId } = useCanvasUrlState();
    const isCanvasRoute = location.pathname.startsWith('/canvas/');

    const resetTracking = useCallback(() => {
        hasAutoSelectedRef.current = false;
        trackedJobIdsRef.current = new Set();
        pendingSelectionRef.current = null;
        refreshInFlightRef.current = false;
    }, []);

    const applySelection = useCallback((selection: PendingSelection): boolean => {
        const analysis = trajectory?.analysis?.find((item) => item._id === selection.analysisId);

        if (!analysis) {
            return false;
        }

        setAnalysisId(analysis._id, { replace: true });

        if (selection.timestep !== undefined) {
            setCurrentTimestep(selection.timestep);
        }

        pendingSelectionRef.current = null;

        return true;
    }, [setAnalysisId, setCurrentTimestep, trajectory]);

    const refreshTrajectory = useCallback(async () => {
        if (!trajectoryId || refreshInFlightRef.current) {
            return;
        }

        refreshInFlightRef.current = true;

        try {
            await refetchTrajectory();
        } catch {
            hasAutoSelectedRef.current = false;
            pendingSelectionRef.current = null;
        } finally {
            refreshInFlightRef.current = false;
        }
    }, [refetchTrajectory, trajectoryId]);

    useEffect(() => {
        resetTracking();
    }, [trajectoryId, resetTracking]);

    const trackActiveJobs = useCallback(() => {
        if (!enabled || !trajectoryId || isCanvasRoute) return;

        for (const job of jobs) {
            if (job.queueType !== ANALYSIS_QUEUE_TYPE) {
                continue;
            }

            if (job.status !== JobStatus.Completed && job.status !== JobStatus.Failed && job.jobId) {
                trackedJobIdsRef.current.add(job.jobId);
            }
        }
    }, [enabled, isCanvasRoute, jobs, trajectoryId]);

    const attemptAutoSelect = useCallback(async () => {
        if (!enabled || !trajectoryId || isCanvasRoute || hasAutoSelectedRef.current) return;

        for (const job of jobs) {
            const isTracked = job.jobId && trackedJobIdsRef.current.has(job.jobId);
            const analysisId = getAnalysisIdFromJob(job);

            if (job.status === JobStatus.Completed && isTracked && analysisId) {
                hasAutoSelectedRef.current = true;
                const selection = { analysisId, timestep: job.timestep };
                pendingSelectionRef.current = selection;

                if (!applySelection(selection)) {
                    refreshTrajectory().catch(() => {
                    });
                }

                break;
            }
        }
    }, [applySelection, enabled, isCanvasRoute, jobs, refreshTrajectory, trajectoryId]);

    useEffect(() => {
        trackActiveJobs();
    }, [trackActiveJobs]);

    useEffect(() => {
        if (isCanvasRoute) {
            resetTracking();
            return;
        }

        if (!enabled) {
            return;
        }

        const pendingSelection = pendingSelectionRef.current;

        if (!pendingSelection) {
            return;
        }

        applySelection(pendingSelection);
    }, [applySelection, enabled, isCanvasRoute, resetTracking, trajectory]);

    useEffect(() => {
        if (!enabled || isCanvasRoute) {
            return;
        }

        attemptAutoSelect().catch(() => {
        });
    }, [attemptAutoSelect, enabled, isCanvasRoute]);

    return { resetTracking };
};

export default useJobsAutoSelectAnalysis;
