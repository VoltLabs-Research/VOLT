import { useCallback } from 'react';
import { container } from 'tsyringe';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useTeamUseCases from '@/modules/team/presentation/hooks/team/use-team-use-cases';
import type ITeamStorage from '@/modules/team/domain/ports/ITeamStorage';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';

const useTeamData = () => {
    const teams = useTeamStore((state) => state.teams);
    const setTeams = useTeamStore((state) => state.setTeams);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const setCanInvite = useTeamStore((state) => state.setCanInvite);
    const setLoading = useTeamStore((state) => state.setLoading);
    const setError = useTeamStore((state) => state.setError);

    const { teamRepository } = useTeamUseCases();

    const fetchTeams = useCallback(async () => {
        if(teams.length > 0) return;

        setLoading(true);
        setError(null);

        try{
            const fetchedTeams = await teamRepository.getAll();
            setTeams(fetchedTeams);
            
            const teamStorage = container.resolve<ITeamStorage>(TEAM_TOKENS.TeamStorage);
            const storedTeamId = teamStorage.getSelectedTeamId();
            const storedTeam = fetchedTeams.find((t) => t._id === storedTeamId);
            const selectedTeam = storedTeam ?? fetchedTeams[0] ?? null;

            if(selectedTeam){
                teamStorage.setSelectedTeamId(selectedTeam._id);
                setSelectedTeam(selectedTeam);
            }
        }catch(error: any){
            console.error('Failed to fetch teams:', error);
            setError(error?.message ?? 'Failed to fetch teams');
        }finally{
            setLoading(false);
        }
    }, [teams.length, teamRepository, setTeams, setSelectedTeam, setLoading, setError]);

    const checkCanInvite = useCallback(async (teamId: string) => {
        try{
            const canInvite = await teamRepository.canInvite(teamId);
            setCanInvite(canInvite);
        }catch{
            setCanInvite(false);
        }
    }, [teamRepository, setCanInvite]);

    return { fetchTeams, checkCanInvite };
};

export default useTeamData;
