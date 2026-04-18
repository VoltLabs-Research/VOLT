import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/team/constants/team-socket-events';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import teamSocketRoomService from '@/modules/socket/team/services/team-socket-room-service';
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
const RASTER_QUEUE_TYPE = 'trajectory_rasterization';

const isTerminalJobStatus = (status: JobStatus): boolean => {
    return status === JobStatus.Completed || status === JobStatus.Failed;
};

const useTeamJobs = ({ subscribe = true }: UseTeamJobsOptions = {}) => {
    const queryClient = useQueryClient();
    const currentTeamId = useSelectedTeamId();
    const socketService = useSocket();
    const previousTeamIdRef = useRef<string | null>(null);
    const latestObservedRevisionRef = useRef(0);
    const trajectoryInvalidationTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const jobsLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

    const handleJobUpdate = useCallback((event: Job) => {
        if (!event.trajectoryId) return;
        if (currentTeamId && typeof event.teamId === 'string' && event.teamId !== currentTeamId) {
            return;
        }
        if (typeof event.revision === 'number' && event.revision < latestObservedRevisionRef.current) {
            return;
        }

        const isRasterUpdate = event.queueType === RASTER_QUEUE_TYPE;

        if (isRasterUpdate) {
            const currentIds = useTeamJobsStore.getState().requestedRasterTrajectoryIds;
            if (currentIds.has(event.trajectoryId)) {
                const nextIds = new Set(currentIds);
                nextIds.delete(event.trajectoryId);
                setRequestedRasterTrajectoryIds(nextIds);
            }
        }

        updateTeamJobsGroupsQueryData((currentGroups) => applyJobUpdate(currentGroups, event), queryClient);

        if (typeof event.revision === 'number') {
            latestObservedRevisionRef.current = Math.max(latestObservedRevisionRef.current, event.revision);
        }

        if (isRasterUpdate) {
            if (event.status === JobStatus.Completed) {
                queryClient.invalidateQueries({
                    queryKey: TRAJECTORY_QUERY_KEYS.preview({ trajectoryId: event.trajectoryId }),
                    exact: true
                });
            }

            return;
        }

        if (!isTerminalJobStatus(event.status)) {
            return;
        }

        clearTimeout(trajectoryInvalidationTimer.current);
        trajectoryInvalidationTimer.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.simulationGrid() });
            queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.trajectories() });
        }, 500);
    }, [currentTeamId, queryClient, setRequestedRasterTrajectoryIds]);

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

    const subscribeToTeam = useCallback((teamId: string, previousTeamId?: string | null) => {
        const currentStoreTeamId = useTeamJobsStore.getState().currentTeamId;
        const roomServiceCurrentTeamId = teamSocketRoomService.getCurrentTeamId();

        if (currentStoreTeamId === teamId && roomServiceCurrentTeamId === teamId) {
            return;
        }

        const resolvedPreviousTeamId = previousTeamId ?? currentStoreTeamId ?? roomServiceCurrentTeamId ?? undefined;
        setCurrentTeamId(teamId);
        latestObservedRevisionRef.current = 0;
        setGroups([]);
        setLoading(true);
        startJobsLoadingTimeout();

        teamSocketRoomService.subscribe(teamId, resolvedPreviousTeamId).catch(() => {
            clearJobsLoadingTimeout();
            setLoading(false);
        });
    }, [clearJobsLoadingTimeout, setCurrentTeamId, setGroups, setLoading, startJobsLoadingTimeout]);

    const clearTeamJobs = useCallback(() => {
        clearJobsLoadingTimeout();
        previousTeamIdRef.current = null;
        latestObservedRevisionRef.current = 0;
        resetTeamJobsGroupsQueryData(queryClient);
        reset();
    }, [clearJobsLoadingTimeout, queryClient, reset]);

    useEffect(() => {
        if (!subscribe) {
            return;
        }

        const unsubscribeFromConnectionChanges = socketService.onConnectionChange(handleConnect);
        const unsubscribeFromInitialJobs = socketService.on(SOCKET_TEAM_EVENTS.JOBS_INITIAL, handleInitialJobsEvent);
        const unsubscribeFromJobUpdates = socketService.on(SOCKET_TEAM_EVENTS.JOB_UPDATED, handleJobUpdateEvent);

        handleConnect(socketService.isConnected());

        if (!socketService.isConnected()) {
            socketService.connect().catch(() => setLoading(false));
        }

        return () => {
            unsubscribeFromConnectionChanges();
            unsubscribeFromInitialJobs();
            unsubscribeFromJobUpdates();
            clearTimeout(trajectoryInvalidationTimer.current);
            clearJobsLoadingTimeout();
            clearTeamJobs();
        };
    }, [clearJobsLoadingTimeout, clearTeamJobs, handleConnect, handleInitialJobsEvent, handleJobUpdateEvent, setLoading, socketService, subscribe]);

    useEffect(() => {
        if (!subscribe) {
            return;
        }

        if (currentTeamId) {
            subscribeToTeam(currentTeamId, previousTeamIdRef.current);
            previousTeamIdRef.current = currentTeamId;
            return;
        }

        clearTeamJobs();
    }, [clearTeamJobs, currentTeamId, subscribeToTeam, subscribe]);

    return {
        groups,
        isConnected,
        isLoading
    };
};

export default useTeamJobs;
