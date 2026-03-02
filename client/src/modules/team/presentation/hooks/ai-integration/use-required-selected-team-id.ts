import { useCallback } from 'react';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';

const useRequiredSelectedTeamId = () => {
    const selectedTeamId = useTeamStore((state) => state.selectedTeam?._id);

    return useCallback(() => {
        if (!selectedTeamId) {
            throw new Error('No team selected');
        }

        return selectedTeamId;
    }, [selectedTeamId]);
};

export default useRequiredSelectedTeamId;
