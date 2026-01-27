import { useEffect } from 'react';
import { useJobStore } from '../stores';
import { useTeamStore } from '@/modules/team/presentation/stores';

export const useTeamJobs = () => {
    const currentTeam = useTeamStore(state => state.selectedTeam);
    const {
        groups,
        isConnected,
        isLoading,
        subscribeToTeamJobs,
        disconnectJobSocket
    } = useJobStore();

    useEffect(() => {
        if (currentTeam?._id) {
            subscribeToTeamJobs(currentTeam._id);
        }
    }, [currentTeam?._id, subscribeToTeamJobs]);

    return {
        groups,
        isConnected,
        isLoading,
        disconnect: disconnectJobSocket
    };
};

export default useTeamJobs;
