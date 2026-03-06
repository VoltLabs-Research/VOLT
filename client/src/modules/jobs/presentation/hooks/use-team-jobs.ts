import { useCallback, useEffect, useRef } from 'react';
import useTeamJobsStore from '@/modules/jobs/presentation/stores/use-team-jobs-store';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import { applyJobUpdate } from '@/modules/jobs/presentation/utilities/job-group-updates';
import type { Job, TrajectoryJobGroup } from '@/modules/jobs/domain/entities/Job';

type JobUpdateEvent = Job & { type?: string; sessionId?: string };

const useTeamJobs = () => {
    const currentTeam = useTeamStore((state) => state.selectedTeam);
    const currentTeamId = currentTeam?._id ?? null;
    const socketService = useSocket();
    const previousTeamIdRef = useRef<string | null>(null);
    const socketServiceRef = useRef(socketService);
    const pendingTeamSubscriptionRef = useRef<{ teamId: string; previousTeamId?: string } | null>(null);

    const groups = useTeamJobsStore((state) => state.groups);
    const isConnected = useTeamJobsStore((state) => state.isConnected);
    const isLoading = useTeamJobsStore((state) => state.isLoading);
    const setGroups = useTeamJobsStore((state) => state.setGroups);
    const setConnected = useTeamJobsStore((state) => state.setConnected);
    const setLoading = useTeamJobsStore((state) => state.setLoading);
    const setExpiredSessions = useTeamJobsStore((state) => state.setExpiredSessions);
    const setCurrentTeamId = useTeamJobsStore((state) => state.setCurrentTeamId);
    const removeTrajectoryGroup = useTeamJobsStore((state) => state.removeTrajectoryGroup);
    const reset = useTeamJobsStore((state) => state.reset);

    const handleConnect = useCallback((connected: boolean) => {
        setConnected(connected);

        if (!connected) {
            setLoading(false);
            return;
        }

        const activeSocketService = socketServiceRef.current;

        if (!activeSocketService) {
            return;
        }

        if (pendingTeamSubscriptionRef.current) {
            activeSocketService.subscribeToTeam(
                pendingTeamSubscriptionRef.current.teamId,
                pendingTeamSubscriptionRef.current.previousTeamId
            );
            pendingTeamSubscriptionRef.current = null;
            return;
        }

        const teamId = useTeamJobsStore.getState().currentTeamId;
        if (teamId) {
            activeSocketService.subscribeToTeam(teamId);
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
        const updatedGroups = applyJobUpdate(useTeamJobsStore.getState().groups, event);
        setGroups(updatedGroups);
    }, [setExpiredSessions, setGroups]);

    const handleInitialJobsEvent = useCallback((payload: unknown) => {
        handleTeamJobs(payload as TrajectoryJobGroup[]);
    }, [handleTeamJobs]);

    const handleJobUpdateEvent = useCallback((payload: unknown) => {
        handleJobUpdate(payload as JobUpdateEvent);
    }, [handleJobUpdate]);

    const subscribeToTeam = useCallback((teamId: string, previousTeamId?: string | null) => {
        const activeSocketService = socketServiceRef.current;

        if (!activeSocketService) {
            return;
        }

        const currentStoreTeamId = useTeamJobsStore.getState().currentTeamId;

        if (currentStoreTeamId === teamId) {
            return;
        }

        const resolvedPreviousTeamId = previousTeamId ?? currentStoreTeamId ?? undefined;
        setCurrentTeamId(teamId);
        setGroups([]);
        setExpiredSessions(new Set());
        setLoading(true);
        pendingTeamSubscriptionRef.current = { teamId, previousTeamId: resolvedPreviousTeamId };

        if (activeSocketService.isConnected()) {
            activeSocketService.subscribeToTeam(teamId, resolvedPreviousTeamId);
            pendingTeamSubscriptionRef.current = null;
            return;
        }

        activeSocketService.connect().catch(() => {
            if (pendingTeamSubscriptionRef.current?.teamId === teamId) {
                pendingTeamSubscriptionRef.current = null;
            }
            setLoading(false);
        });
    }, [setCurrentTeamId, setExpiredSessions, setGroups, setLoading]);

    const clearTeamJobs = useCallback(() => {
        pendingTeamSubscriptionRef.current = null;
        previousTeamIdRef.current = null;
        reset();
    }, [reset]);

    useEffect(() => {
        socketServiceRef.current = socketService;

        const unsubscribeFromConnectionChanges = socketService.onConnectionChange(handleConnect);
        const unsubscribeFromInitialJobs = socketService.on('team.jobs.initial', handleInitialJobsEvent);
        const unsubscribeFromJobUpdates = socketService.on('team.job.updated', handleJobUpdateEvent);

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
        isLoading,
        removeTrajectoryGroup
    };
};

export default useTeamJobs;
