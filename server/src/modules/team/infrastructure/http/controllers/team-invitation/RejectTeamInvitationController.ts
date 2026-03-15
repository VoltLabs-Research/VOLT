import { createController } from '@shared/infrastructure/http/controllers/createController';
import RejectTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/RejectTeamInvitationUseCase';

const RejectTeamInvitationController = createController(RejectTeamInvitationUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default RejectTeamInvitationController;
