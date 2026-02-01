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
            const members = await teamMemberRepository.getAll(teamId);
            setMembers(members);
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
