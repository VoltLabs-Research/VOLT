import useResolve from '@/shared/presentation/hooks/use-resolve';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamRoleRepository from '@/modules/team/domain/port/ITeamRoleRepository';

const useTeamRoleUseCases = () => {
    return {
        teamRoleRepository: useResolve<ITeamRoleRepository>(TEAM_TOKENS.TeamRoleRepository)
    };
};

export default useTeamRoleUseCases;
