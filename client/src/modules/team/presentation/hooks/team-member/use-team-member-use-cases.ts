import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamMemberRepository from '@/modules/team/domain/ports/ITeamMemberRepository';

const useTeamMemberUseCases = createUseCasesHook({
    teamMemberRepository: TEAM_TOKENS.TeamMemberRepository
}) as () => {
    teamMemberRepository: ITeamMemberRepository;
};

export default useTeamMemberUseCases;
