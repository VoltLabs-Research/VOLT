import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useCanvasAnalysisStatus from './use-canvas-analysis-status';
import { isRunningJobStatus } from '../utils/analysis-job-status';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Job } from '@volt/contracts/modules/jobs/domain';
import type { TimelineTickTone } from '../utils/analysis-status-selectors';

const SESSION_COMPLETION_HIGHLIGHT_MS = 3500;

const resolveTimestep = (job: Job): number | undefined => {
    return job.timestep ?? job.metadata?.timestep;
};

/**
 * Timeline tick presentation: the shared status, plus a brief flash when a frame lands.
 *
 * This hook used to derive frame status itself with a raw `.some(isQueued)` per frame,
 * which made it a fourth opinion on a question the server and two other hooks already
 * answered — and because it ignored which analysis a job belonged to, a queued PTM run
 * painted a tick orange while the DXA row beside it read as running. Status now comes
 * from `useCanvasAnalysisStatus`; all that is left here is the ephemeral highlight,
 * which is genuinely presentation and has no other home.
 */
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

        /* Only a job this session watched running earns a flash on landing. */
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

    /**
     * Tone for one tick, scoped to the selected analysis when there is one.
     *
     * The completion flash wins while it lasts, because it is the one thing here the
     * shared status cannot express: a frame that just finished looks the same to the
     * selectors as one that finished an hour ago.
     */
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
