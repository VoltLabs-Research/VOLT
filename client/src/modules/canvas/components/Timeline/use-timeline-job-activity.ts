import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useCanvasAnalysisStatus from '../../hooks/use-canvas-analysis-status';
import { isRunningJobStatus } from '../../utils/analysis-job-status';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Job } from '@volt/contracts/modules/jobs/domain';
import type { TimelineTickTone } from '../../utils/analysis-status-selectors';

const SESSION_COMPLETION_HIGHLIGHT_MS = 3500;

const resolveTimestep = (job: Job): number | undefined => {
    return job.timestep ?? job.metadata?.timestep;
};

const useTimelineJobActivity = (trajectoryId?: string, analysisId?: string) => {
    const { getFrameTone, getAnalysisFrameStatus } = useCanvasAnalysisStatus({
        trajectoryId,
        enabled: !!trajectoryId
    });

    const runningJobIdsRef = useRef<Set<string>>(new Set());
    const completionTimersRef = useRef<Map<number, number>>(new Map());
    const [completedTimesteps, setCompletedTimesteps] = useState<Set<number>>(new Set());

    const clearAllCompletionTimers = useCallback(() => {
        completionTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
        completionTimersRef.current.clear();
    }, []);

    const clearCompletedHighlight = useCallback((timestep: number) => {
        const existingTimer = completionTimersRef.current.get(timestep);
        if (existingTimer) {
            window.clearTimeout(existingTimer);
            completionTimersRef.current.delete(timestep);
        }

        setCompletedTimesteps((current) => {
            if (!current.has(timestep)) {
                return current;
            }

            const next = new Set(current);
            next.delete(timestep);
            return next;
        });
    }, []);

    const markCompletedHighlight = useCallback((timestep: number) => {
        clearCompletedHighlight(timestep);

        setCompletedTimesteps((current) => {
            const next = new Set(current);
            next.add(timestep);
            return next;
        });

        const timerId = window.setTimeout(() => {
            clearCompletedHighlight(timestep);
        }, SESSION_COMPLETION_HIGHLIGHT_MS);

        completionTimersRef.current.set(timestep, timerId);
    }, [clearCompletedHighlight]);

    useEffect(() => {
        runningJobIdsRef.current = new Set();
        setCompletedTimesteps(new Set());
        clearAllCompletionTimers();
    }, [clearAllCompletionTimers, trajectoryId]);

    useEffect(() => {
        return () => {
            clearAllCompletionTimers();
        };
    }, [clearAllCompletionTimers]);

    const handleJobUpdated = useCallback((job: Job) => {
        if (!trajectoryId || job.trajectoryId !== trajectoryId) {
            return;
        }

        const timestep = resolveTimestep(job);
        if (timestep === undefined) {
            return;
        }

        if (isRunningJobStatus(job.status)) {
            runningJobIdsRef.current.add(job.jobId);
            return;
        }

        if (job.status === JobStatus.Completed) {
            if (runningJobIdsRef.current.has(job.jobId)) {
                markCompletedHighlight(timestep);
            }

            runningJobIdsRef.current.delete(job.jobId);
            return;
        }

        runningJobIdsRef.current.delete(job.jobId);
    }, [markCompletedHighlight, trajectoryId]);

    useSocketEvent<Job>(SOCKET_TEAM_EVENTS.JOB_UPDATED, handleJobUpdated, { enabled: !!trajectoryId });

    const getTickTone = useCallback((timestep: number): TimelineTickTone | undefined => {
        if (completedTimesteps.has(timestep)) return 'completed';

        return getFrameTone(timestep, analysisId);
    }, [analysisId, completedTimesteps, getFrameTone]);

    return {
        getTickTone,
        getAnalysisFrameStatus
    };
};

export default useTimelineJobActivity;
