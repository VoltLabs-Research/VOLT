import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/team/constants/team-socket-events';
import { TRAJECTORY_QUERY_KEYS } from '@/modules/trajectory/hooks/trajectory/queries';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import teamSocketRoomService from '@/modules/socket/team/services/team-socket-room-service';
import useTeamJobsStore from '../stores/use-team-jobs-store';
import { applyJobUpdate } from '../utilities/job-group-updates';
import {
    resetTeamJobsGroupsQueryData,
    setTeamJobsGroupsQueryData,
    updateTeamJobsGroupsQueryData,
    teamJobsGroups
} from './queries';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import type { Job, TrajectoryJobGroup } from '../api/entities/job';

type JobUpdateEvent = Job & { type?: string; sessionId?: string };
type TeamJobsEventPayload = TrajectoryJobGroup[];

const TEAM_JOBS_INITIAL_LOAD_TIMEOUT_MS = 5000;

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
    const setExpiredSessions = useTeamJobsStore((state) => state.setExpiredSessions);
    const setCurrentTeamId = useTeamJobsStore((state) => state.setCurrentTeamId);
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

    const handleTeamJobs = useCallback((incomingGroups: TrajectoryJobGroup[]) => {
        clearJobsLoadingTimeout();
        setGroups(incomingGroups);
        setLoading(false);
    }, [clearJobsLoadingTimeout, setGroups, setLoading]);

    const handleJobUpdate = useCallback((event: JobUpdateEvent) => {
        if (event.type === 'session_expired' && event.sessionId) {
            const expiredSessions = useTeamJobsStore.getState().expiredSessions;
            const nextExpiredSessions = new Set(expiredSessions);
            nextExpiredSessions.add(event.sessionId);
            setExpiredSessions(nextExpiredSessions);
            return;
        }

        if (!event.trajectoryId) return;

        updateTeamJobsGroupsQueryData((currentGroups) => applyJobUpdate(currentGroups, event), queryClient);

        clearTimeout(trajectoryInvalidationTimer.current);
        trajectoryInvalidationTimer.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.simulationGrid() });
            queryClient.invalidateQueries({ queryKey: TRAJECTORY_QUERY_KEYS.trajectories() });
        }, 500);
    }, [queryClient, setExpiredSessions]);

    const handleInitialJobsEvent = useCallback((payload: TeamJobsEventPayload) => {
        handleTeamJobs(payload);
    }, [handleTeamJobs]);

    const handleJobUpdateEvent = useCallback((payload: JobUpdateEvent) => {
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
        setExpiredSessions(new Set());
        setLoading(true);
        startJobsLoadingTimeout();

        teamSocketRoomService.subscribe(teamId, resolvedPreviousTeamId).catch(() => {
            clearJobsLoadingTimeout();
            setLoading(false);
        });
    }, [clearJobsLoadingTimeout, setCurrentTeamId, setExpiredSessions, setGroups, setLoading, startJobsLoadingTimeout]);

    const clearTeamJobs = useCallback(() => {
        clearJobsLoadingTimeout();
        previousTeamIdRef.current = null;
        resetTeamJobsGroupsQueryData(queryClient);
        reset();
    }, [clearJobsLoadingTimeout, queryClient, reset]);

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
