import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import useSocket from '@/modules/socket/hooks/use-socket';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { JobStatus } from '../api/entities/job';
import useTeamJobsStore from '../stores/use-team-jobs-store';
import { applyJobUpdate } from '../utilities/job-group-updates';
import {
    resetTeamJobsGroupsQueryData,
    setTeamJobsGroupsQueryData,
    updateTeamJobsGroupsQueryData,
    teamJobsGroups
} from './queries';
import type { Job, TrajectoryJobGroup } from '../api/entities/job';

interface TeamJobsEventPayload {
    revision: number;
    groups: TrajectoryJobGroup[];
};

interface UseTeamJobsOptions {
    subscribe?: boolean;
};

const TEAM_JOBS_INITIAL_LOAD_TIMEOUT_MS = 5000;
const TEAM_JOBS_UPDATE_FLUSH_INTERVAL_MS = 50;
const RASTER_QUEUE_TYPE = 'trajectory_rasterization';

const isTerminalJobStatus = (status: JobStatus): boolean => {
    return status === JobStatus.Completed || status === JobStatus.Failed;
};

const useTeamJobs = ({ subscribe = true }: UseTeamJobsOptions = {}) => {
    const queryClient = useQueryClient();
    const currentTeamId = useSelectedTeamId();
    const socketService = useSocket();
    const latestObservedRevisionRef = useRef(0);
    const trajectoryInvalidationTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const jobsLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const pendingJobUpdatesRef = useRef<Job[]>([]);
    const jobUpdateFlushTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const isConnected = useTeamJobsStore((state) => state.isConnected);
    const isLoading = useTeamJobsStore((state) => state.isLoading);
    const setConnected = useTeamJobsStore((state) => state.setConnected);
    const setLoading = useTeamJobsStore((state) => state.setLoading);
    const setCurrentTeamId = useTeamJobsStore((state) => state.setCurrentTeamId);
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

    const setGroups = useCallback((newGroups: TrajectoryJobGroup[]) => {
        setTeamJobsGroupsQueryData(newGroups, queryClient);
    }, [queryClient]);

    const handleConnect = useCallback((connected: boolean) => {
        setConnected(connected);

        if (!connected) {
            clearJobsLoadingTimeout();
            setLoading(false);
        }
    }, [clearJobsLoadingTimeout, setConnected, setLoading]);

    const handleTeamJobs = useCallback((incomingGroups: TrajectoryJobGroup[], revision?: number) => {
        clearJobsLoadingTimeout();

        if (typeof revision === 'number') {
            latestObservedRevisionRef.current = Math.max(latestObservedRevisionRef.current, revision);
        }

        setGroups(incomingGroups);
        setLoading(false);
    }, [clearJobsLoadingTimeout, setGroups, setLoading]);

    const flushPendingJobUpdates = useCallback(() => {
        jobUpdateFlushTimerRef.current = undefined;

        const queued = pendingJobUpdatesRef.current;
        if (queued.length === 0) return;
        pendingJobUpdatesRef.current = [];

        const currentIds = useTeamJobsStore.getState().requestedRasterTrajectoryIds;
        let nextRasterIds: Set<string> | null = null;
        let hasTerminalNonRaster = false;
        const rasterCompletedTrajectoryIds = new Set<string>();

        for (const event of queued) {
            const isRasterUpdate = event.queueType === RASTER_QUEUE_TYPE;
            if (isRasterUpdate) {
                if (currentIds.has(event.trajectoryId!)) {
                    if (!nextRasterIds) nextRasterIds = new Set(currentIds);
                    nextRasterIds.delete(event.trajectoryId!);
                }
                if (event.status === JobStatus.Completed) {
                    rasterCompletedTrajectoryIds.add(event.trajectoryId!);
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
        }, queryClient);

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
    }, [queryClient, setRequestedRasterTrajectoryIds]);

    const handleJobUpdate = useCallback((event: Job) => {
        if (!event.trajectoryId) return;
        if (currentTeamId && typeof event.teamId === 'string' && event.teamId !== currentTeamId) {
            return;
        }
        if (typeof event.revision === 'number' && event.revision < latestObservedRevisionRef.current) {
            return;
        }

        if (typeof event.revision === 'number') {
            latestObservedRevisionRef.current = Math.max(latestObservedRevisionRef.current, event.revision);
        }

        pendingJobUpdatesRef.current.push(event);

        if (jobUpdateFlushTimerRef.current === undefined) {
            jobUpdateFlushTimerRef.current = setTimeout(flushPendingJobUpdates, TEAM_JOBS_UPDATE_FLUSH_INTERVAL_MS);
        }
    }, [currentTeamId, flushPendingJobUpdates]);

    const handleInitialJobsEvent = useCallback((payload: TeamJobsEventPayload) => {
        if (payload.revision < latestObservedRevisionRef.current) {
            clearJobsLoadingTimeout();
            setLoading(false);
            return;
        }

        handleTeamJobs(payload.groups, payload.revision);
    }, [clearJobsLoadingTimeout, handleTeamJobs, setLoading]);

    const handleJobUpdateEvent = useCallback((payload: Job) => {
        handleJobUpdate(payload);
    }, [handleJobUpdate]);

    const prepareTeamJobs = useCallback((teamId: string) => {
        const currentStoreTeamId = useTeamJobsStore.getState().currentTeamId;

        if (currentStoreTeamId === teamId) {
            return;
        }

        setCurrentTeamId(teamId);
        latestObservedRevisionRef.current = 0;
        setGroups([]);
        setLoading(true);
        startJobsLoadingTimeout();
    }, [setCurrentTeamId, setGroups, setLoading, startJobsLoadingTimeout]);

    const clearTeamJobs = useCallback(() => {
        clearJobsLoadingTimeout();
        if (jobUpdateFlushTimerRef.current !== undefined) {
            clearTimeout(jobUpdateFlushTimerRef.current);
            jobUpdateFlushTimerRef.current = undefined;
        }
        pendingJobUpdatesRef.current = [];
        latestObservedRevisionRef.current = 0;
        resetTeamJobsGroupsQueryData(queryClient);
        reset();
    }, [clearJobsLoadingTimeout, queryClient, reset]);

    useSocketEvent<TeamJobsEventPayload>(SOCKET_TEAM_EVENTS.JOBS_INITIAL, handleInitialJobsEvent, { enabled: subscribe });
    useSocketEvent<Job>(SOCKET_TEAM_EVENTS.JOB_UPDATED, handleJobUpdateEvent, { enabled: subscribe });

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
