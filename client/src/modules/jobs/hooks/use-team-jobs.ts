import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useTeamJobsStore from '../stores/use-team-jobs-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useSocket from '@/modules/socket/hooks/use-socket';
import useTeamSocketRoom from '@/modules/socket/hooks/use-team-socket-room';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/api/entities/socket-constants';
import { applyJobUpdate } from '../utilities/job-group-updates';
import type { Job, TrajectoryJobGroup } from '../api/entities/job';
import {
    resetTeamJobsGroupsQueryData,
    setTeamJobsGroupsQueryData,
    updateTeamJobsGroupsQueryData,
    teamJobsGroups
} from './queries';

type JobUpdateEvent = Job & { type?: string; sessionId?: string };

const useTeamJobs = () => {
    const queryClient = useQueryClient();
    const currentTeamId = useSelectedTeamId();
    const socketService = useSocket();
    const teamSocketRoom = useTeamSocketRoom();
    const previousTeamIdRef = useRef<string | null>(null);

    const isConnected = useTeamJobsStore((state) => state.isConnected);
    const isLoading = useTeamJobsStore((state) => state.isLoading);
    const setConnected = useTeamJobsStore((state) => state.setConnected);
    const setLoading = useTeamJobsStore((state) => state.setLoading);
    const setExpiredSessions = useTeamJobsStore((state) => state.setExpiredSessions);
    const setCurrentTeamId = useTeamJobsStore((state) => state.setCurrentTeamId);
    const reset = useTeamJobsStore((state) => state.reset);

    const { data: groups = [] } = teamJobsGroups();

    const setGroups = useCallback((newGroups: TrajectoryJobGroup[]) => {
        setTeamJobsGroupsQueryData(newGroups, queryClient);
    }, [queryClient]);

    const handleConnect = useCallback((connected: boolean) => {
        setConnected(connected);

        if (!connected) {
            setLoading(false);
        }
    }, [setConnected, setLoading]);

    const handleTeamJobs = useCallback((incomingGroups: TrajectoryJobGroup[]) => {
        setGroups(incomingGroups);
        setLoading(false);
    }, [setGroups, setLoading]);

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
    }, [queryClient, setExpiredSessions]);

    const handleInitialJobsEvent = useCallback((payload: unknown) => {
        handleTeamJobs(payload as TrajectoryJobGroup[]);
    }, [handleTeamJobs]);

    const handleJobUpdateEvent = useCallback((payload: unknown) => {
        handleJobUpdate(payload as JobUpdateEvent);
    }, [handleJobUpdate]);

    const subscribeToTeam = useCallback((teamId: string, previousTeamId?: string | null) => {
        const currentStoreTeamId = useTeamJobsStore.getState().currentTeamId;
        const roomServiceCurrentTeamId = teamSocketRoom.getCurrentTeamId();

        if (currentStoreTeamId === teamId && roomServiceCurrentTeamId === teamId) {
            return;
        }

        const resolvedPreviousTeamId = previousTeamId ?? currentStoreTeamId ?? roomServiceCurrentTeamId ?? undefined;
        setCurrentTeamId(teamId);
        setGroups([]);
        setExpiredSessions(new Set());
        setLoading(true);

        teamSocketRoom.subscribe(teamId, resolvedPreviousTeamId).catch(() => {
            setLoading(false);
        });
    }, [setCurrentTeamId, setExpiredSessions, setGroups, setLoading, teamSocketRoom]);

    const clearTeamJobs = useCallback(() => {
        previousTeamIdRef.current = null;
        resetTeamJobsGroupsQueryData(queryClient);
        reset();
    }, [queryClient, reset]);

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
            clearTeamJobs();
        };
    }, [clearTeamJobs, handleConnect, handleInitialJobsEvent, handleJobUpdateEvent, setLoading, socketService]);

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
