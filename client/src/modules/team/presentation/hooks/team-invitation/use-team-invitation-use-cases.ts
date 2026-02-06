import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamInvitationRepository from '@/modules/team/domain/ports/ITeamInvitationRepository';

const useTeamInvitationUseCases = createUseCasesHook({
    teamInvitationRepository: TEAM_TOKENS.TeamInvitationRepository
}) as () => {
    teamInvitationRepository: ITeamInvitationRepository;
};

export default useTeamInvitationUseCases;
