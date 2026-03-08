import { useCallback } from 'react';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';

const useRequiredSelectedTeamId = () => {
    const selectedTeamId = useSelectedTeamId();

    return useCallback(() => {
        if (!selectedTeamId) {
            throw new Error('No team selected');
        }

        return selectedTeamId;
    }, [selectedTeamId]);
};

export default useRequiredSelectedTeamId;
