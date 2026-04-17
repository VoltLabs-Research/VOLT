import { teamJobsGroups } from '@/modules/jobs/hooks/queries';
import { JobStatus } from '@/modules/jobs/api/entities/job';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/team/constants/team-socket-events';
import useSocketEvent from '@/modules/socket/core/hooks/use-socket-event';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Job } from '@/modules/jobs/api/entities/job';

export type TimelineTickTone = 'queued' | 'running' | 'completed';
export type AnalysisFrameActivityStatus = 'queued' | 'running' | 'completed' | 'failed';

const SESSION_COMPLETION_HIGHLIGHT_MS = 3500;

const isQueuedStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Queued || status === JobStatus.QueuedAfterFailure;
};

const isRunningStatus = (status: JobStatus | string | undefined): boolean => {
    return status === JobStatus.Running || status === JobStatus.Retrying;
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

const resolveTimestep = (job: Job): number | undefined => {
    return job.timestep ?? job.metadata?.timestep;
};

const useTimelineJobActivity = (trajectoryId?: string) => {
    const { data: groups = [] } = teamJobsGroups();
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

    useEffect(() => {
        if (!trajectoryId) {
            return;
        }

        for (const group of groups) {
            if (group.trajectoryId !== trajectoryId) {
                continue;
            }

            for (const frameGroup of group.frameGroups) {
                for (const job of frameGroup.jobs) {
                    if (isRunningStatus(job.status)) {
                        runningJobIdsRef.current.add(job.jobId);
                    }
                }
            }
        }
    }, [groups, trajectoryId]);

    const handleJobUpdated = useCallback((job: Job) => {
        if (!trajectoryId || job.trajectoryId !== trajectoryId) {
            return;
        }

        const timestep = resolveTimestep(job);
        if (typeof timestep !== 'number') {
            return;
        }

        if (isRunningStatus(job.status)) {
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

    const toneByTimestep = useMemo(() => {
        const next = new Map<number, TimelineTickTone>();

        if (!trajectoryId) {
            return next;
        }

        for (const group of groups) {
            if (group.trajectoryId !== trajectoryId) {
                continue;
            }

            for (const frameGroup of group.frameGroups) {
                const timestep = frameGroup.timestep;

                if (completedTimesteps.has(timestep)) {
                    next.set(timestep, 'completed');
                    continue;
                }

                const hasRunning = frameGroup.jobs.some((job) => isRunningStatus(job.status));
                if (hasRunning) {
                    next.set(timestep, 'running');
                    continue;
                }

                const hasQueued = frameGroup.jobs.some((job) => isQueuedStatus(job.status));
                if (hasQueued) {
                    next.set(timestep, 'queued');
                }
            }
        }

        return next;
    }, [completedTimesteps, groups, trajectoryId]);

    const getAnalysisFrameStatus = useCallback((
        analysisId: string,
        timestep: number
    ): AnalysisFrameActivityStatus | undefined => {
        if (!trajectoryId) {
            return undefined;
        }

        for (const group of groups) {
            if (group.trajectoryId !== trajectoryId) {
                continue;
            }

            const frameGroup = group.frameGroups.find((frame) => frame.timestep === timestep);
            if (!frameGroup) {
                continue;
            }

            const matchingJobs = frameGroup.jobs.filter((job) => resolveAnalysisId(job) === analysisId);
            if (matchingJobs.length === 0) {
                continue;
            }

            if (matchingJobs.some((job) => isRunningStatus(job.status))) {
                return 'running';
            }

            if (matchingJobs.some((job) => isQueuedStatus(job.status))) {
                return 'queued';
            }

            if (matchingJobs.some((job) => job.status === JobStatus.Failed)) {
                return 'failed';
            }

            if (matchingJobs.some((job) => job.status === JobStatus.Completed)) {
                return 'completed';
            }
        }

        return undefined;
    }, [groups, trajectoryId]);

    return {
        toneByTimestep,
        getAnalysisFrameStatus
    };
};

export default useTimelineJobActivity;
