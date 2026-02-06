import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamRepository from '@/modules/team/domain/ports/ITeamRepository';
import type CreateTeamUseCase from '@/modules/team/application/use-cases/team/CreateTeamUseCase';

const useTeamUseCases = createUseCasesHook({
    createTeamUseCase: TEAM_TOKENS.CreateTeamUseCase,
    teamRepository: TEAM_TOKENS.TeamRepository
}) as () => {
    createTeamUseCase: CreateTeamUseCase;
    teamRepository: ITeamRepository;
};

export default useTeamUseCases;
