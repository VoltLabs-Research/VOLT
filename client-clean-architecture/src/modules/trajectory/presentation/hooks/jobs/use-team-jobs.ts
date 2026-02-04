import { useEffect, useRef } from 'react';
import useTeamJobsStore from '@/modules/trajectory/presentation/stores/use-team-jobs-store';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';

const useTeamJobs = () => {
    const currentTeam = useTeamStore((state) => state.selectedTeam);
    const socketService = useSocket();
    const previousTeamIdRef = useRef<string | null>(null);

    const {
        groups,
        isConnected,
        isLoading,
        subscribeToTeam,
        unsubscribeFromTeam,
        disconnect,
        initializeSocket
    } = useTeamJobsStore();

    useEffect(() => {
        if (!socketService) return;
        initializeSocket(socketService);
    }, [socketService, initializeSocket]);

    useEffect(() => {
        if (currentTeam?._id) {
            subscribeToTeam(currentTeam._id, previousTeamIdRef.current);
            previousTeamIdRef.current = currentTeam._id;
        } else {
            unsubscribeFromTeam();
        }
    }, [currentTeam?._id, subscribeToTeam, unsubscribeFromTeam]);

    return {
        groups,
        isConnected,
        isLoading,
        disconnect
    };
};

export default useTeamJobs;
