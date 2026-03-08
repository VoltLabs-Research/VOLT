import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetTeamInvitationByIdUseCase from '@modules/team/application/use-cases/team-invitation/GetTeamInvitationByIdUseCase';

const GetTeamInvitationByIdController = createController(GetTeamInvitationByIdUseCase);
export default GetTeamInvitationByIdController;
