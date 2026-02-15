import { useCallback, useEffect, useRef } from 'react';
import useTeamJobsStore from '@/modules/jobs/presentation/stores/use-team-jobs-store';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import { applyJobUpdate } from '@/modules/jobs/presentation/utils/job-group-updates';
import type { Job, TrajectoryJobGroup } from '@/modules/jobs/domain/entities/Job';
import type ISocketService from '@/modules/socket/domain/ports/ISocketService';

type JobUpdateEvent = Job & { type?: string; sessionId?: string };

let socketServiceRef: ISocketService | null = null;
let connectionUnsubscribe: (() => void) | null = null;
let teamJobsUnsubscribe: (() => void) | null = null;
let jobUpdateUnsubscribe: (() => void) | null = null;
let isSocketInitialized = false;
let pendingTeamSubscription: { teamId: string; previousTeamId?: string | null } | null = null;

const useTeamJobs = () => {
    const currentTeam = useTeamStore((state) => state.selectedTeam);
    const socketService = useSocket();
    const previousTeamIdRef = useRef<string | null>(null);

    const groups = useTeamJobsStore((state) => state.groups);
    const isConnected = useTeamJobsStore((state) => state.isConnected);
    const isLoading = useTeamJobsStore((state) => state.isLoading);
    const setGroups = useTeamJobsStore((state) => state.setGroups);
    const setConnected = useTeamJobsStore((state) => state.setConnected);
    const setLoading = useTeamJobsStore((state) => state.setLoading);
    const setExpiredSessions = useTeamJobsStore((state) => state.setExpiredSessions);
    const setCurrentTeamId = useTeamJobsStore((state) => state.setCurrentTeamId);
    const removeTrajectoryGroup = useTeamJobsStore((state) => state.removeTrajectoryGroup);

    const handleConnect = useCallback((connected: boolean) => {
        setConnected(connected);
        if (!connected) return;
        if (!socketServiceRef) return;

        if (pendingTeamSubscription) {
            socketServiceRef.subscribeToTeam(
                pendingTeamSubscription.teamId,
                pendingTeamSubscription.previousTeamId || undefined
            );
            pendingTeamSubscription = null;
            return;
        }

        const teamId = useTeamJobsStore.getState().currentTeamId;
        if (teamId) socketServiceRef.subscribeToTeam(teamId);
    }, [setConnected]);

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

    const initializeSocket = useCallback(() => {
        if (!socketServiceRef) return;
        if (isSocketInitialized) {
            if (!socketServiceRef.isConnected()) {
                socketServiceRef.connect().catch(() => setLoading(false));
            } else {
                setConnected(true);
            }
            return;
        }

        connectionUnsubscribe = socketServiceRef.onConnectionChange(handleConnect);
        teamJobsUnsubscribe = socketServiceRef.on('team.jobs.initial', handleTeamJobs);
        jobUpdateUnsubscribe = socketServiceRef.on('team.job.updated', handleJobUpdate);
        isSocketInitialized = true;

        if (!socketServiceRef.isConnected()) {
            socketServiceRef.connect().catch(() => setLoading(false));
        } else {
            setConnected(true);
        }
    }, [handleConnect, handleJobUpdate, handleTeamJobs, setConnected, setLoading]);

    const subscribeToTeam = useCallback((teamId: string, previousTeamId?: string | null) => {
        if (!socketServiceRef) return;
        const { currentTeamId } = useTeamJobsStore.getState();
        if (currentTeamId === teamId) return;
        initializeSocket();
        setCurrentTeamId(teamId);
        setGroups([]);
        setExpiredSessions(new Set());
        setLoading(true);
        pendingTeamSubscription = { teamId, previousTeamId: previousTeamId || currentTeamId || undefined };
        if (socketServiceRef.isConnected()) {
            socketServiceRef.subscribeToTeam(teamId, previousTeamId || currentTeamId || undefined);
            pendingTeamSubscription = null;
        }
    }, [initializeSocket, setCurrentTeamId, setGroups, setExpiredSessions, setLoading]);

    const unsubscribeFromTeam = useCallback(() => {
        pendingTeamSubscription = null;
        setCurrentTeamId(null);
        setGroups([]);
        setExpiredSessions(new Set());
        setLoading(true);
    }, [setCurrentTeamId, setGroups, setExpiredSessions, setLoading]);

    useEffect(() => {
        if (!socketService) return;
        socketServiceRef = socketService;
        initializeSocket();
    }, [socketService, initializeSocket]);

    useEffect(() => {
        if (currentTeam?._id) {
            subscribeToTeam(currentTeam._id, previousTeamIdRef.current);
            previousTeamIdRef.current = currentTeam._id;
            return;
        }

        unsubscribeFromTeam();
    }, [currentTeam?._id, subscribeToTeam, unsubscribeFromTeam]);

    return {
        groups,
        isConnected,
        isLoading,
        removeTrajectoryGroup
    };
};

export default useTeamJobs;
