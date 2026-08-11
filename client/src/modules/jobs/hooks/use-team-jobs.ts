import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import useSocket from '@/modules/socket/hooks/use-socket';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import queryClient from '@/shared/query/query-client';
import { useCallback, useEffect, useRef } from 'react';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import useTeamJobsStore from '../store/use-team-jobs-store';
import { applyJobUpdate } from '../utils/job-group-updates';
import {
    setTeamJobsGroupsQueryData,
    updateTeamJobsGroupsQueryData,
    teamJobsGroups
} from './queries';
import type { Job, TeamJobsSnapshot, TrajectoryJobGroup } from '@volt/contracts/modules/jobs/domain';

interface UseTeamJobsOptions {
    subscribe?: boolean;
};

const TEAM_JOBS_INITIAL_LOAD_TIMEOUT_MS = 5000;
const TEAM_JOBS_UPDATE_FLUSH_INTERVAL_MS = 50;
const RASTER_QUEUE_TYPE = 'trajectory_rasterization';

const isTerminalJobStatus = (status: JobStatus): boolean => {
    return status === JobStatus.Completed || status === JobStatus.Failed;
};

const isPendingRevision = (job: Job, appliedRevision: number): boolean => {
    return job.revision === undefined || job.revision > appliedRevision;
};

const useTeamJobs = ({ subscribe = true }: UseTeamJobsOptions = {}) => {
    const currentTeamId = useSelectedTeamId();
    const socketService = useSocket();
    const trajectoryInvalidationTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const jobsLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const pendingJobUpdatesRef = useRef<Job[]>([]);
    const jobUpdateFlushTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const isConnected = useTeamJobsStore((state) => state.isConnected);
    const isLoading = useTeamJobsStore((state) => state.isLoading);
    const latestAppliedRevision = useTeamJobsStore((state) => state.latestAppliedRevision);
    const setConnected = useTeamJobsStore((state) => state.setConnected);
    const setLoading = useTeamJobsStore((state) => state.setLoading);
    const setCurrentTeamId = useTeamJobsStore((state) => state.setCurrentTeamId);
    const setLatestAppliedRevision = useTeamJobsStore((state) => state.setLatestAppliedRevision);
    const setRequestedRasterTrajectoryIds = useTeamJobsStore((state) => state.setRequestedRasterTrajectoryIds);
    const reset = useTeamJobsStore((state) => state.reset);

    const { data: groups = [] } = teamJobsGroups();

    const clearJobsLoadingTimeout = useCallback(() => {
        clearTimeout(jobsLoadingTimeoutRef.current);
        jobsLoadingTimeoutRef.current = undefined;
    }, []);

    const startJobsLoadingTimeout = useCallback(() => {
        clearJobsLoadingTimeout();
        jobsLoadingTimeoutRef.current = setTimeout(() => {
            setLoading(false);
        }, TEAM_JOBS_INITIAL_LOAD_TIMEOUT_MS);
    }, [clearJobsLoadingTimeout, setLoading]);

    const handleConnect = useCallback((connected: boolean) => {
        setConnected(connected);

        if (!connected) {
            clearJobsLoadingTimeout();
            setLoading(false);
        }
    }, [clearJobsLoadingTimeout, setConnected, setLoading]);

    const handleTeamJobs = useCallback((incomingGroups: TrajectoryJobGroup[], revision?: number) => {
        clearJobsLoadingTimeout();

        if (revision !== undefined) {
            setLatestAppliedRevision(revision);
        }

        setTeamJobsGroupsQueryData(incomingGroups);
        setLoading(false);
    }, [clearJobsLoadingTimeout, setLatestAppliedRevision, setLoading]);

    const flushPendingJobUpdates = useCallback(() => {
        jobUpdateFlushTimerRef.current = undefined;

        const appliedRevision = useTeamJobsStore.getState().latestAppliedRevision;
        const queued = pendingJobUpdatesRef.current.filter((event) => isPendingRevision(event, appliedRevision));
        if (queued.length === 0) return;
        pendingJobUpdatesRef.current = [];

        const currentIds = useTeamJobsStore.getState().requestedRasterTrajectoryIds;
        let nextRasterIds: Set<string> | null = null;
        let hasTerminalNonRaster = false;
        const rasterCompletedTrajectoryIds = new Set<string>();

        for (const event of queued) {
            const isRasterUpdate = event.queueType === RASTER_QUEUE_TYPE;
            if (isRasterUpdate) {
                if (currentIds.has(event.trajectoryId)) {
                    if (!nextRasterIds) nextRasterIds = new Set(currentIds);
                    nextRasterIds.delete(event.trajectoryId);
                }
                if (event.status === JobStatus.Completed) {
                    rasterCompletedTrajectoryIds.add(event.trajectoryId);
                }
            } else if (isTerminalJobStatus(event.status)) {
                hasTerminalNonRaster = true;
            }
        }

        if (nextRasterIds) {
            setRequestedRasterTrajectoryIds(nextRasterIds);
        }

        updateTeamJobsGroupsQueryData((currentGroups) => {
            let groups = currentGroups;
            for (const event of queued) {
                groups = applyJobUpdate(groups, event);
            }
            return groups;
        });

        const maxAppliedRevision = queued.reduce((highestRevision, event) => {
            if (event.revision === undefined) {
                return highestRevision;
            }

            return Math.max(highestRevision, event.revision);
        }, appliedRevision);

        if (maxAppliedRevision > appliedRevision) {
            setLatestAppliedRevision(maxAppliedRevision);
        }

        for (const trajectoryId of rasterCompletedTrajectoryIds) {
            queryClient.invalidateQueries({
                queryKey: TRAJECTORY_QUERY_KEYS.preview({ trajectoryId }),
                exact: true
            });
        }

        if (hasTerminalNonRaster) {
            clearTimeout(trajectoryInvalidationTimer.current);
            trajectoryInvalidationTimer.current = setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.simulationGrid() });
                queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.trajectories() });
            }, 500);
        }
    }, [setLatestAppliedRevision, setRequestedRasterTrajectoryIds]);

    const handleJobUpdate = useCallback((event: Job) => {
        if (currentTeamId && event.teamId !== currentTeamId) {
            return;
        }
        if (event.revision !== undefined && event.revision <= latestAppliedRevision) {
            return;
        }

        pendingJobUpdatesRef.current.push(event);

        if (jobUpdateFlushTimerRef.current === undefined) {
            jobUpdateFlushTimerRef.current = setTimeout(flushPendingJobUpdates, TEAM_JOBS_UPDATE_FLUSH_INTERVAL_MS);
        }
    }, [currentTeamId, flushPendingJobUpdates, latestAppliedRevision]);

    const handleInitialJobsEvent = useCallback((payload: TeamJobsSnapshot) => {
        if (payload.revision < latestAppliedRevision) {
            clearJobsLoadingTimeout();
            setLoading(false);
            return;
        }

        handleTeamJobs(payload.groups, payload.revision);
    }, [clearJobsLoadingTimeout, handleTeamJobs, latestAppliedRevision, setLoading]);

    const prepareTeamJobs = useCallback((teamId: string) => {
        const currentStoreTeamId = useTeamJobsStore.getState().currentTeamId;

        if (currentStoreTeamId === teamId) {
            return;
        }

        setCurrentTeamId(teamId);
        setLatestAppliedRevision(0);
        setTeamJobsGroupsQueryData([]);
        setLoading(true);
        startJobsLoadingTimeout();
    }, [setCurrentTeamId, setLatestAppliedRevision, setLoading, startJobsLoadingTimeout]);

    const clearTeamJobs = useCallback(() => {
        clearJobsLoadingTimeout();
        if (jobUpdateFlushTimerRef.current !== undefined) {
            clearTimeout(jobUpdateFlushTimerRef.current);
            jobUpdateFlushTimerRef.current = undefined;
        }
        pendingJobUpdatesRef.current = [];
        setTeamJobsGroupsQueryData([]);
        reset();
    }, [clearJobsLoadingTimeout, reset]);

    useSocketEvent<TeamJobsSnapshot>(SOCKET_TEAM_EVENTS.JOBS_INITIAL, handleInitialJobsEvent, { enabled: subscribe });
    useSocketEvent<Job>(SOCKET_TEAM_EVENTS.JOB_UPDATED, handleJobUpdate, { enabled: subscribe });

    useEffect(() => {
        const remainingPendingUpdates = pendingJobUpdatesRef.current.filter((event) => {
            return isPendingRevision(event, latestAppliedRevision);
        });

        if (remainingPendingUpdates.length === pendingJobUpdatesRef.current.length) {
            return;
        }

        pendingJobUpdatesRef.current = remainingPendingUpdates;

        if (remainingPendingUpdates.length === 0 && jobUpdateFlushTimerRef.current !== undefined) {
            clearTimeout(jobUpdateFlushTimerRef.current);
            jobUpdateFlushTimerRef.current = undefined;
        }
    }, [latestAppliedRevision]);

    useEffect(() => {
        if (!subscribe) {
            return;
        }

        const unsubscribeFromConnectionChanges = socketService.onConnectionChange(handleConnect);

        handleConnect(socketService.isConnected());

        if (!socketService.isConnected()) {
            socketService.connect().catch(() => setLoading(false));
        }

        return () => {
            unsubscribeFromConnectionChanges();
            clearTimeout(trajectoryInvalidationTimer.current);
            clearJobsLoadingTimeout();
            clearTeamJobs();
        };
    }, [clearJobsLoadingTimeout, clearTeamJobs, handleConnect, setLoading, socketService, subscribe]);

    useEffect(() => {
        if (!subscribe) {
            return;
        }

        if (currentTeamId) {
            prepareTeamJobs(currentTeamId);
            return;
        }

        clearTeamJobs();
    }, [clearTeamJobs, currentTeamId, prepareTeamJobs, subscribe]);

    return {
        groups,
        isConnected,
        isLoading
    };
};

export default useTeamJobs;
