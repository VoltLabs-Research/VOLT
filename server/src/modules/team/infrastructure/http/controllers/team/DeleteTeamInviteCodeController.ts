import { createController } from '@shared/infrastructure/http/controllers/createController';
import DeleteTeamInviteCodeUseCase from '@modules/team/application/use-cases/team/DeleteTeamInviteCodeUseCase';

const DeleteTeamInviteCodeController = createController(DeleteTeamInviteCodeUseCase);
export default DeleteTeamInviteCodeController;
