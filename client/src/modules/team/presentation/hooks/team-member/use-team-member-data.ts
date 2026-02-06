import { useCallback } from 'react';
import { useTeamMemberStore } from '@/modules/team/presentation/stores/use-team-member-store';
import useTeamMemberUseCases from '@/modules/team/presentation/hooks/team-member/use-team-member-use-cases';

const useTeamMemberData = () => {
    const setMembers = useTeamMemberStore((state) => state.setMembers);
    const setLoading = useTeamMemberStore((state) => state.setLoading);
    const setError = useTeamMemberStore((state) => state.setError);

    const { teamMemberRepository } = useTeamMemberUseCases();

    const fetchMembers = useCallback(async (teamId: string) => {
        setLoading(true);

        try{
            const response = await teamMemberRepository.getAll(teamId, { page: 1, limit: 100 });
            setMembers(response.data);
        }catch(error: any){
            console.error('Failed to fetch members:', error);
            setError(error?.message ?? 'Failed to fetch members');
        }finally{
            setLoading(false);
        }
    }, [teamMemberRepository, setMembers, setLoading, setError]);

    return { fetchMembers };
};

export default useTeamMemberData;
