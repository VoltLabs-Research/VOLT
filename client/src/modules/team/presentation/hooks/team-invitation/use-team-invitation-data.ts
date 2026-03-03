import { useCallback } from 'react';
import { sileo } from 'sileo';
import { useTeamInvitationStore } from '@/modules/team/presentation/stores/use-team-invitation-store';
import useTeamInvitationUseCases from '@/modules/team/presentation/hooks/team-invitation/use-team-invitation-use-cases';

const useTeamInvitationData = () => {
    const setInvitations = useTeamInvitationStore((state) => state.setInvitations);
    const setLoading = useTeamInvitationStore((state) => state.setLoading);
    const setError = useTeamInvitationStore((state) => state.setError);

    const { teamInvitationRepository } = useTeamInvitationUseCases();

    const fetchPendingInvitations = useCallback(async () => {
        setLoading(true);

        try{
            const invitations = await teamInvitationRepository.getPending();
            setInvitations(invitations);
        }catch(error: any){
            sileo.error({ title: 'Failed to fetch invitations' });
            setError(error?.message ?? 'Failed to fetch invitations');
        }finally{
            setLoading(false);
        }
    }, [teamInvitationRepository, setInvitations, setLoading, setError]);

    return { fetchPendingInvitations };
};

export default useTeamInvitationData;
