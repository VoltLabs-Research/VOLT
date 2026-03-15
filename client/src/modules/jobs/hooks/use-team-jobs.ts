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
    getTeamJobsGroupsQueryData,
    resetTeamJobsGroupsQueryData,
    setTeamJobsGroupsQueryData,
    updateTeamJobsGroupsQueryData,
    teamJobsGroups
} from './queries';
import type { Job, TrajectoryJobGroup } from '../api/entities/job';

type TeamJobsEventPayload = TrajectoryJobGroup[];

const TEAM_JOBS_INITIAL_LOAD_TIMEOUT_MS = 5000;
const RASTER_QUEUE_TYPE = 'trajectory_rasterization';

const buildRasterJobKey = (trajectoryId: string, timestep?: number): string | null => {
    if (typeof timestep !== 'number' || !Number.isFinite(timestep)) {
        return null;
    }

    return `${trajectoryId}:${timestep}`;
};

const extractRasterPendingKeys = (groups: TrajectoryJobGroup[]): Set<string> => {
    const pendingKeys = new Set<string>();

    for (const group of groups) {
        for (const frameGroup of group.frameGroups) {
            for (const job of frameGroup.jobs) {
                if (job.queueType !== RASTER_QUEUE_TYPE) {
                    continue;
                }

                const isPending = job.status !== JobStatus.Completed && job.status !== JobStatus.Failed;
                if (!isPending) {
                    continue;
                }

                const timestep = typeof job.timestep === 'number'
                    ? job.timestep
                    : typeof job.metadata?.timestep === 'number'
                        ? job.metadata.timestep
                        : undefined;
                const pendingKey = buildRasterJobKey(job.trajectoryId, timestep);

                if (pendingKey) {
                    pendingKeys.add(pendingKey);
                }
            }
        }
    }

    return pendingKeys;
};

const useTeamJobs = () => {
    const queryClient = useQueryClient();
    const currentTeamId = useSelectedTeamId();
    const socketService = useSocket();
    const previousTeamIdRef = useRef<string | null>(null);
    const trajectoryInvalidationTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const jobsLoadingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const isConnected = useTeamJobsStore((state) => state.isConnected);
    const isLoading = useTeamJobsStore((state) => state.isLoading);
    const setConnected = useTeamJobsStore((state) => state.setConnected);
    const setLoading = useTeamJobsStore((state) => state.setLoading);
    const setCurrentTeamId = useTeamJobsStore((state) => state.setCurrentTeamId);
    const setPendingRasterKeys = useTeamJobsStore((state) => state.setPendingRasterKeys);
    const setInFlightRasterTrajectoryIds = useTeamJobsStore((state) => state.setInFlightRasterTrajectoryIds);
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
        setPendingRasterKeys(extractRasterPendingKeys(newGroups));
    }, [queryClient, setPendingRasterKeys]);

    const handleConnect = useCallback((connected: boolean) => {
        setConnected(connected);

        if (!connected) {
            clearJobsLoadingTimeout();
            setLoading(false);
        }
    }, [clearJobsLoadingTimeout, setConnected, setLoading]);

    const handleTeamJobs = useCallback((incomingGroups: TrajectoryJobGroup[]) => {
        clearJobsLoadingTimeout();
        setGroups(incomingGroups);
        setLoading(false);
    }, [clearJobsLoadingTimeout, setGroups, setLoading]);

    const handleJobUpdate = useCallback((event: Job) => {
        if (!event.trajectoryId) return;

        const isRasterUpdate = event.queueType === RASTER_QUEUE_TYPE;

        if (event.queueType === RASTER_QUEUE_TYPE) {
            const currentIds = useTeamJobsStore.getState().inFlightRasterTrajectoryIds;
            if (currentIds.has(event.trajectoryId)) {
                const nextIds = new Set(currentIds);
                nextIds.delete(event.trajectoryId);
                setInFlightRasterTrajectoryIds(nextIds);
            }
        }

        updateTeamJobsGroupsQueryData((currentGroups) => applyJobUpdate(currentGroups, event), queryClient);
        setPendingRasterKeys(extractRasterPendingKeys(getTeamJobsGroupsQueryData(queryClient)));

        if (isRasterUpdate) {
            if (event.status === JobStatus.Completed) {
                queryClient.invalidateQueries({
                    queryKey: TRAJECTORY_QUERY_KEYS.preview({ trajectoryId: event.trajectoryId }),
                    exact: true
                });
            }

            return;
        }

        clearTimeout(trajectoryInvalidationTimer.current);
        trajectoryInvalidationTimer.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.simulationGrid() });
            queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.trajectories() });
        }, 500);
    }, [queryClient, setInFlightRasterTrajectoryIds, setPendingRasterKeys]);

    const handleInitialJobsEvent = useCallback((payload: TeamJobsEventPayload) => {
        handleTeamJobs(payload);
    }, [handleTeamJobs]);

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
        resetTeamJobsGroupsQueryData(queryClient);
        setPendingRasterKeys(new Set<string>());
        setInFlightRasterTrajectoryIds(new Set<string>());
        reset();
    }, [clearJobsLoadingTimeout, queryClient, reset, setInFlightRasterTrajectoryIds, setPendingRasterKeys]);

    useEffect(() => {
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
    }, [clearJobsLoadingTimeout, clearTeamJobs, handleConnect, handleInitialJobsEvent, handleJobUpdateEvent, setLoading, socketService]);

    useEffect(() => {
        if (currentTeamId) {
            subscribeToTeam(currentTeamId, previousTeamIdRef.current);
            previousTeamIdRef.current = currentTeamId;
            return;
        }

        clearTeamJobs();
    }, [clearTeamJobs, currentTeamId, subscribeToTeam]);

    return {
        groups,
        isConnected,
        isLoading
    };
};

export default useTeamJobs;
