import { createController } from '@shared/infrastructure/http/controllers/createController';
import UpdateTeamByIdUseCase from '@modules/team/application/use-cases/team/UpdateTeamByIdUseCase';

const UpdateTeamByIdController = createController(UpdateTeamByIdUseCase);
export default UpdateTeamByIdController;
