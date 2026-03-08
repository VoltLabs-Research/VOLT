import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useCallback } from 'react';

export default function useRequiredSelectedTeamId() {
    const selectedTeamId = useSelectedTeamId();

    return useCallback(() => {
        if (!selectedTeamId) {
            throw new Error('No team selected');
        }

        return selectedTeamId;
    }, [selectedTeamId]);
}
