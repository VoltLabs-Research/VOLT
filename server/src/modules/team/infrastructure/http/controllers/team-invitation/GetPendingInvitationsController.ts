import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetPendingInvitationsUseCase from '@modules/team/application/use-cases/team-invitation/GetPendingInvitationsUseCase';

const GetPendingInvitationsController = createController(GetPendingInvitationsUseCase);
export default GetPendingInvitationsController;
