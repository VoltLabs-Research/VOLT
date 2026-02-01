import { useCallback } from 'react';
import { useTeamInvitationStore } from '@/modules/team/presentation/stores/use-team-invitation-store';
import useTeamInvitationUseCases from '@/modules/team/presentation/hooks/team-invitation/use-team-invitation-use-cases';

const useTeamInvitationData = () => {
    const setPendingInvitations = useTeamInvitationStore((state) => state.setPendingInvitations);
    const setLoading = useTeamInvitationStore((state) => state.setLoading);
    const setError = useTeamInvitationStore((state) => state.setError);

    const { teamInvitationRepository } = useTeamInvitationUseCases();

    const fetchPendingInvitations = useCallback(async () => {
        setLoading(true);

        try{
            const pendingInvitations = await teamInvitationRepository.getPending();
            setPendingInvitations(pendingInvitations);
        }catch(error: any){
            console.error('Failed to fetch invitations:', error);
            setError(error?.message ?? 'Failed to fetch invitations');
        }finally{
            setLoading(false);
        }
    }, [teamInvitationRepository, setPendingInvitations, setLoading, setError]);

    return { fetchPendingInvitations };
};

export default useTeamInvitationData;
