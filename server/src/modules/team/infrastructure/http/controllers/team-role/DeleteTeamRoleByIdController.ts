import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import DeleteTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/DeleteTeamRoleByIdUseCase';

const DeleteTeamRoleByIdController = createController(DeleteTeamRoleByIdUseCase, HttpStatus.NoContent);
export default DeleteTeamRoleByIdController;
