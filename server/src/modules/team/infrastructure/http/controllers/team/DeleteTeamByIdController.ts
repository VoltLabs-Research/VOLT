import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import DeleteTeamByIdUseCase from '@modules/team/application/use-cases/team/DeleteTeamByIdUseCase';

const DeleteTeamByIdController = createController(DeleteTeamByIdUseCase, HttpStatus.NoContent);
export default DeleteTeamByIdController;
