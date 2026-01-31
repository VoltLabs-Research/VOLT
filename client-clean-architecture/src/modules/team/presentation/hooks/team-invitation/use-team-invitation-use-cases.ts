import { useMemo } from 'react';
import { container } from 'tsyringe';
import {
    GetInvitationDetailsUseCase,
    GetPendingInvitationsUseCase,
    SendInvitationUseCase,
    AcceptInvitationUseCase,
    RejectInvitationUseCase,
    CancelInvitationUseCase
} from '@/modules/team/application/use-cases/team-invitation';
import { TEAM_TOKENS } from '@/modules/team/infrastructure/di/tokens';

const useTeamInvitationUseCases = () => {
    const getInvitationDetailsUseCase = useMemo(() => {
        return container.resolve<GetInvitationDetailsUseCase>(TEAM_TOKENS.GetInvitationDetailsUseCase);
    }, []);

    const getPendingInvitationsUseCase = useMemo(() => {
        return container.resolve<GetPendingInvitationsUseCase>(TEAM_TOKENS.GetPendingInvitationsUseCase);
    }, []);

    const sendInvitationUseCase = useMemo(() => {
        return container.resolve<SendInvitationUseCase>(TEAM_TOKENS.SendInvitationUseCase);
    }, []);

    const acceptInvitationUseCase = useMemo(() => {
        return container.resolve<AcceptInvitationUseCase>(TEAM_TOKENS.AcceptInvitationUseCase);
    }, []);

    const rejectInvitationUseCase = useMemo(() => {
        return container.resolve<RejectInvitationUseCase>(TEAM_TOKENS.RejectInvitationUseCase);
    }, []);

    const cancelInvitationUseCase = useMemo(() => {
        return container.resolve<CancelInvitationUseCase>(TEAM_TOKENS.CancelInvitationUseCase);
    }, []);

    return {
        getInvitationDetailsUseCase,
        getPendingInvitationsUseCase,
        sendInvitationUseCase,
        acceptInvitationUseCase,
        rejectInvitationUseCase,
        cancelInvitationUseCase
    };
};

export default useTeamInvitationUseCases;
