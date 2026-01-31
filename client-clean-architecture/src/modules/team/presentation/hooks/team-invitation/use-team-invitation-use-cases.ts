import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';
import type {
    GetInvitationDetailsUseCase,
    GetPendingInvitationsUseCase,
    SendInvitationUseCase,
    AcceptInvitationUseCase,
    RejectInvitationUseCase,
    CancelInvitationUseCase
} from '@/modules/team/application/use-cases/team-invitation';

const useTeamInvitationUseCases = createUseCasesHook({
    getInvitationDetailsUseCase: TEAM_TOKENS.GetInvitationDetailsUseCase,
    getPendingInvitationsUseCase: TEAM_TOKENS.GetPendingInvitationsUseCase,
    sendInvitationUseCase: TEAM_TOKENS.SendInvitationUseCase,
    acceptInvitationUseCase: TEAM_TOKENS.AcceptInvitationUseCase,
    rejectInvitationUseCase: TEAM_TOKENS.RejectInvitationUseCase,
    cancelInvitationUseCase: TEAM_TOKENS.CancelInvitationUseCase
}) as () => {
    getInvitationDetailsUseCase: GetInvitationDetailsUseCase;
    getPendingInvitationsUseCase: GetPendingInvitationsUseCase;
    sendInvitationUseCase: SendInvitationUseCase;
    acceptInvitationUseCase: AcceptInvitationUseCase;
    rejectInvitationUseCase: RejectInvitationUseCase;
    cancelInvitationUseCase: CancelInvitationUseCase;
};

export default useTeamInvitationUseCases;
