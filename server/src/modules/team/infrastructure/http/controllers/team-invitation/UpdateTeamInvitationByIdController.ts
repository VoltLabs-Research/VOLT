import { createController } from '@shared/infrastructure/http/controllers/createController';
import UpdateTeamInvitationByIdUseCase from '@modules/team/application/use-cases/team-invitation/UpdateTeamInvitationByIdUseCase';

const UpdateTeamInvitationByIdController = createController(UpdateTeamInvitationByIdUseCase);
export default UpdateTeamInvitationByIdController;
