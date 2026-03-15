import { createController } from '@shared/infrastructure/http/controllers/createController';
import AcceptTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/AcceptTeamInvitationUseCase';

const AcceptTeamInvitationController = createController(AcceptTeamInvitationUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});

export default AcceptTeamInvitationController;
