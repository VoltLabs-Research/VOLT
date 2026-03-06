import { useCallback } from 'react';
import { container } from 'tsyringe';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useTeamUseCases from '@/modules/team/presentation/hooks/team/use-team-use-cases';
import type ITeamStorage from '@/modules/team/domain/port/ITeamStorage';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';

const useTeamData = () => {
    const teams = useTeamStore((state) => state.teams);
    const setTeams = useTeamStore((state) => state.setTeams);
    const setSelectedTeam = useTeamStore((state) => state.setSelectedTeam);
    const setPermissions = useTeamStore((state) => state.setPermissions);
    const setPermissionsLoading = useTeamStore((state) => state.setPermissionsLoading);
    const setLoading = useTeamStore((state) => state.setLoading);
    const setError = useTeamStore((state) => state.setError);

    const { teamRepository } = useTeamUseCases();
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

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
            if(checkRBACError(error)) return;
            sileo.error({ title: 'Failed to load teams' });
            setError(error?.message ?? 'Failed to fetch teams');
        }finally{
            setLoading(false);
        }
    }, [teams.length, teamRepository, setTeams, setSelectedTeam, setLoading, setError]);

    const syncPermissions = useCallback(async (
        teamId: string,
        options?: { showLoadingToast?: boolean; clearOnError?: boolean }
    ) => {
        const teamStorage = container.resolve<ITeamStorage>(TEAM_TOKENS.TeamStorage);
        const request = async () => {
            const permissions = await teamRepository.getMyPermissions(teamId);
            setPermissions(permissions, teamId);
            teamStorage.setTeamPermissions(teamId, permissions);
            return permissions;
        };

        const showLoadingToast = options?.showLoadingToast ?? false;
        const clearOnError = options?.clearOnError ?? false;

        setPermissionsLoading(showLoadingToast);
        try {
            if (showLoadingToast) {
                await showPromise(request(), {
                    loading: {
                        title: 'Loading permissions',
                        description: 'Setting up your access for this team.'
                    },
                    success: {
                        title: 'Permissions loaded'
                    },
                    error: {
                        title: 'Failed to load permissions'
                    }
                });
            } else {
                await request();
            }
        } catch {
            if (clearOnError) {
                setPermissions([], teamId);
            }
        } finally {
            setPermissionsLoading(false);
        }
    }, [teamRepository, setPermissions, setPermissionsLoading]);

    const hydrateTeamAccess = useCallback(async (teamId: string) => {
        const teamStorage = container.resolve<ITeamStorage>(TEAM_TOKENS.TeamStorage);
        const cachedPermissions = teamStorage.getTeamPermissions(teamId);

        if (cachedPermissions) {
            setPermissions(cachedPermissions, teamId);
            setPermissionsLoading(false);
            await syncPermissions(teamId, { showLoadingToast: false, clearOnError: false });
            return;
        }

        await syncPermissions(teamId, { showLoadingToast: true, clearOnError: true });
    }, [setPermissions, setPermissionsLoading, syncPermissions]);

    return { fetchTeams, hydrateTeamAccess, accessDenied, accessDeniedMessage };
};

export default useTeamData;
