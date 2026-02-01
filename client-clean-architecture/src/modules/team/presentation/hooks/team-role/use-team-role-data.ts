import { useCallback } from 'react';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import useTeamRoleUseCases from '@/modules/team/presentation/hooks/team-role/use-team-role-use-cases';

const useTeamRoleData = () => {
    const setRoles = useTeamRoleStore((state) => state.setRoles);
    const setLoading = useTeamRoleStore((state) => state.setLoading);
    const setError = useTeamRoleStore((state) => state.setError);

    const { teamRoleRepository } = useTeamRoleUseCases();

    const fetchRoles = useCallback(async (teamId: string) => {
        setLoading(true);

        try{
            const response = await teamRoleRepository.getAll(teamId, { page: 1, limit: 100 });
            setRoles(response.data);
        }catch(error: any){
            console.error('Failed to fetch roles:', error);
            setError(error?.message ?? 'Failed to fetch roles');
        }finally{
            setLoading(false);
        }
    }, [teamRoleRepository, setRoles, setLoading, setError]);

    return { fetchRoles };
};

export default useTeamRoleData;
