import { useCallback } from 'react';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import useTeamRoleUseCases from '@/modules/team/presentation/hooks/team-role/use-team-role-use-cases';

const useTeamRoleData = () => {
    const setRoles = useTeamRoleStore((state) => state.setRoles);
    const setLoading = useTeamRoleStore((state) => state.setLoading);
    const setError = useTeamRoleStore((state) => state.setError);

    const { getAllTeamRolesUseCase } = useTeamRoleUseCases();

    const fetchRoles = useCallback(async (teamId: string) => {
        setLoading(true);

        try{
            const roles = await getAllTeamRolesUseCase.execute({ teamId });
            setRoles(roles);
        }catch(error: any){
            console.error('Failed to fetch roles:', error);
            setError(error?.message ?? 'Failed to fetch roles');
        }finally{
            setLoading(false);
        }
    }, [getAllTeamRolesUseCase, setRoles, setLoading, setError]);

    return { fetchRoles };
};

export default useTeamRoleData;
