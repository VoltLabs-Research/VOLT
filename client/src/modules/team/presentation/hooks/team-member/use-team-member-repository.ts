import useResolve from '@/shared/presentation/hooks/use-resolve';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamMemberRepository from '@/modules/team/domain/port/ITeamMemberRepository';

const useTeamMemberUseCases = () => {
    return {
        teamMemberRepository: useResolve<ITeamMemberRepository>(TEAM_TOKENS.TeamMemberRepository)
    };
};

export default useTeamMemberUseCases;
