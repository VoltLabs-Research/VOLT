import useResolve from '@/shared/presentation/hooks/use-resolve';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type ITeamInvitationRepository from '@/modules/team/domain/port/ITeamInvitationRepository';

const useTeamInvitationUseCases = () => {
    return {
        teamInvitationRepository: useResolve<ITeamInvitationRepository>(TEAM_TOKENS.TeamInvitationRepository)
    };
};

export default useTeamInvitationUseCases;
