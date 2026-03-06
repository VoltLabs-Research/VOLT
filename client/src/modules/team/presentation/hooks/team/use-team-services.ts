import useResolve from '@/shared/presentation/hooks/use-resolve';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamRepository from '@/modules/team/domain/port/ITeamRepository';
import type CreateTeamUseCase from '@/modules/team/application/use-cases/team/CreateTeamUseCase';

const useTeamUseCases = () => {
    return {
        createTeamUseCase: useResolve<CreateTeamUseCase>(TEAM_TOKENS.CreateTeamUseCase),
        teamRepository: useResolve<ITeamRepository>(TEAM_TOKENS.TeamRepository)
    };
};

export default useTeamUseCases;
