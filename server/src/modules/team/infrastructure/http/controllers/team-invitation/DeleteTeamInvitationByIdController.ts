import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import DeleteTeamInvitationByIdUseCase from '@modules/team/application/use-cases/team-invitation/DeleteTeamInvitationByIdUseCase';

const DeleteTeamInvitationByIdController = createController(DeleteTeamInvitationByIdUseCase, HttpStatus.NoContent);
export default DeleteTeamInvitationByIdController;
