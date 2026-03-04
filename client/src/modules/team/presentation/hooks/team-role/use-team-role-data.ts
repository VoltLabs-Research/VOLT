import { useCallback } from 'react';
import { sileo } from 'sileo';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import useTeamRoleUseCases from '@/modules/team/presentation/hooks/team-role/use-team-role-use-cases';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';

const useTeamRoleData = () => {
    const setRoles = useTeamRoleStore((state) => state.setRoles);
    const setLoading = useTeamRoleStore((state) => state.setLoading);
    const setError = useTeamRoleStore((state) => state.setError);

    const { teamRoleRepository } = useTeamRoleUseCases();
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const fetchRoles = useCallback(async (teamId: string) => {
        setLoading(true);

        try{
            const response = await teamRoleRepository.getAll(teamId, { page: 1, limit: 100 });
            setRoles(response.data);
        }catch(error: any){
            if(checkRBACError(error)) return;
            sileo.error({ title: 'Failed to fetch roles' });
            setError(error?.message ?? 'Failed to fetch roles');
        }finally{
            setLoading(false);
        }
    }, [teamRoleRepository, setRoles, setLoading, setError, checkRBACError]);

    return { fetchRoles, accessDenied, accessDeniedMessage };
};

export default useTeamRoleData;
