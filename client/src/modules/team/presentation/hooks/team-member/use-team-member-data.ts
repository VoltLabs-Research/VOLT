import { useCallback } from 'react';
import { sileo } from 'sileo';
import { useTeamMemberStore } from '@/modules/team/presentation/stores/use-team-member-store';
import useTeamMemberUseCases from '@/modules/team/presentation/hooks/team-member/use-team-member-repository';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';

const useTeamMemberData = () => {
    const setMembers = useTeamMemberStore((state) => state.setMembers);
    const setLoading = useTeamMemberStore((state) => state.setLoading);
    const setError = useTeamMemberStore((state) => state.setError);
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const { teamMemberRepository } = useTeamMemberUseCases();

    const fetchMembers = useCallback(async (teamId: string) => {
        setLoading(true);

        try{
            const response = await teamMemberRepository.getAll(teamId, { page: 1, limit: 100 });
            setMembers(response.data);
        }catch(error: any){
            if(checkRBACError(error)) return;
            sileo.error({ title: 'Failed to fetch team members' });
            setError(error?.message ?? 'Failed to fetch members');
        }finally{
            setLoading(false);
        }
    }, [teamMemberRepository, setMembers, setLoading, setError, checkRBACError]);

    return { fetchMembers, accessDenied, accessDeniedMessage };
};

export default useTeamMemberData;
